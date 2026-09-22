import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { test } from "node:test";
import { InMemoryCredentialStore, InMemoryModelsStore } from "@earendil-works/pi-ai";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { prepareInput, reviewText } from "../src/review.ts";
import { deferred, fixtureJSON, source } from "./helpers.ts";

function send(res: ServerResponse, content: string) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const base = { id: "test", object: "chat.completion.chunk", created: 1, model: "reviewer" };

  for (const choice of [
    { index: 0, delta: { role: "assistant", content }, finish_reason: null },
    { index: 0, delta: {}, finish_reason: "stop" },
  ]) res.write(`data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`);
  res.end("data: [DONE]\n\n");
}

test("real Pi ModelRegistry HTTP transport: reviewer and main context stay separate and can run concurrently", async () => {
  const reviewArrived = deferred<void>();
  let reviewResponse: ServerResponse | undefined;
  const requests: { messages: object[] }[] = [];

  const server = createServer(async (req, res) => {
    const chunks = [];

    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body: { messages: object[] } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push(body);

    if (JSON.stringify(body.messages).includes("You are pi-polyglot")) {
      reviewResponse = res;
      reviewArrived.resolve(); // Hold this response until the coding request finishes.
    } else send(res, "WORK_OK");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address instanceof Object && "port" in address);
    const port = address.port;

    const runtime = await ModelRuntime.create({
      credentials: new InMemoryCredentialStore(), modelsStore: new InMemoryModelsStore(),
      modelsPath: null, refreshOnCreate: false, allowModelNetwork: false,
    });

    const registry = new ModelRegistry(runtime);
    registry.registerProvider("local-polyglot-test", {
      baseUrl: `http://127.0.0.1:${port}/v1`, api: "openai-completions", apiKey: "test-only",
      models: [{ id: "reviewer", name: "Reviewer", reasoning: false, input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 2000 }],
    });
    const model = registry.find("local-polyglot-test", "reviewer"); assert.ok(model);
    const reviewPromise = reviewText(registry, model, { targetLanguage: "en", nativeLanguage: "pt-BR" }, prepareInput(source)!, AbortSignal.timeout(5000));
    await reviewArrived.promise;

    const mainContext = { systemPrompt: "CODING_CONTEXT_SENTINEL: only do work", messages: [
      { role: "user" as const, content: "PRIVATE_PAST_MESSAGE", timestamp: 1 },
      { role: "user" as const, content: source, timestamp: 2 },
    ] };

    const before = structuredClone(mainContext);
    const work = await registry.complete(model, mainContext, { signal: AbortSignal.timeout(5000) });
    assert.equal(work.stopReason, "stop");
    assert.deepEqual(mainContext, before);
    assert.ok(reviewResponse);
    send(reviewResponse, fixtureJSON);
    const result = await reviewPromise;
    assert.equal(result.edits.length, 1);
    assert.equal(requests.length, 2);
    const reviewer = JSON.stringify(requests[0]);
    assert.ok(!reviewer.includes("PRIVATE_PAST_MESSAGE"));
    assert.ok(!reviewer.includes("CODING_CONTEXT_SENTINEL"));
    assert.ok(!reviewer.includes('"tools":[{'));
    const main = JSON.stringify(requests[1]);
    assert.ok(main.includes("PRIVATE_PAST_MESSAGE"));
    assert.ok(!main.includes("pi-polyglot"));
    assert.ok(!main.includes("nativeLanguage"));
    assert.ok(main.includes(source));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
