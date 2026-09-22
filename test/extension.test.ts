import assert from "node:assert/strict";
import { test } from "node:test";
import type { AssistantMessage, Context, ModelsApiStreamOptions, Api } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, ExtensionUIContext, ModelRegistry, RegisteredCommand } from "@earendil-works/pi-coding-agent";
import polyglot from "../src/extension.ts";
import { deferred, fixtureJSON, flush, model, response, source, strictFake, theme } from "./helpers.ts";

function harness() {
  const events = new Map<string, unknown>();
  let command: Omit<RegisteredCommand, "name" | "sourceInfo"> | undefined;
  const api = strictFake<ExtensionAPI>({
    on: (name, handler) => { events.set(name, handler); },
    registerCommand: (name, options) => { assert.equal(name, "polyglot"); command = options; },
  });
  let widget: unknown;
  let status: string | undefined;
  const notifications: string[] = [];
  const jobs: { model: string; context: Context; options: ModelsApiStreamOptions<Api> | undefined; result: ReturnType<typeof deferred<AssistantMessage>> }[] = [];
  const registry = strictFake<ModelRegistry>({
    complete: async (selected, context, options) => {
      const result = deferred<AssistantMessage>();
      jobs.push({ model: selected.id, context, options, result });
      return result.promise;
    },
    find: (provider, id) => provider === "test" && id === "separate" ? { ...model, id } : undefined,
  });
  const ctx = strictFake<ExtensionCommandContext>({
    mode: "tui", hasUI: true, model, modelRegistry: registry,
    ui: strictFake<ExtensionUIContext>({
      theme,
      setWidget: (_key, value, options) => { widget = value; if (value) assert.equal(options?.placement, "belowEditor"); },
      setStatus: (_key, value) => { status = value; },
      notify: (text) => { notifications.push(text); },
    }),
  });
  polyglot(api);
  function event(name: string, value: object = {}) {
    const handler = events.get(name) as ((event: object, ctx: ExtensionContext) => unknown) | undefined;
    assert.ok(handler, name);
    return handler(value, ctx);
  }
  return {
    ctx, jobs, notifications, event,
    input: (text = source, sourceKind = "interactive") => event("input", { type: "input", text, source: sourceKind }),
    command: (args: string) => { assert.ok(command); return command.handler(args, ctx); },
    completions: (prefix: string) => { assert.ok(command); return command.getArgumentCompletions?.(prefix); },
    description: () => { assert.ok(command); return command.description; },
    widget: () => widget, status: () => status,
  };
}

test("disabled by default; input returns immediately unchanged; no forbidden principal-session capabilities", async () => {
  const h = harness(); h.event("session_start");
  assert.deepEqual(h.input(), { action: "continue" }); await flush(); assert.equal(h.jobs.length, 0);
  await h.command("on");
  const result = h.input();
  assert.deepEqual(result, { action: "continue" }); assert.equal(result instanceof Promise, false);
  assert.equal(h.jobs.length, 0); // Deferred until after hook returns.
  await flush(); assert.equal(h.jobs.length, 1);
  assert.equal(h.jobs[0]!.context.messages.length, 1);
  assert.equal(JSON.parse(String(h.jobs[0]!.context.messages[0]!.content)).text, source);
  assert.equal(h.widget(), undefined);
  h.jobs[0]!.result.resolve(response(fixtureJSON)); await flush();
  assert.equal(typeof h.widget(), "function");
  h.event("session_shutdown");
});
test("UI defaults to English and stays English with a different explanation language", async () => {
  const h = harness(); h.event("session_start");
  assert.match(h.description()!, /Isolated language feedback/);
  await h.command("status");
  assert.match(h.notifications.at(-1)!, /Native language: English/);
  assert.match(h.notifications.at(-1)!, /Model: Pi's active model/);
  assert.match(h.notifications.at(-1)!, /No reviews yet/);
  await h.command("native pt-BR");
  assert.match(h.notifications.at(-1)!, /Preference updated/);
  await h.command("on");
  assert.match(h.notifications.at(-1)!, /explanations in Brazilian Portuguese/);
  await h.command("status");
  assert.match(h.notifications.at(-1)!, /Native language: Brazilian Portuguese/);
  assert.match(h.notifications.at(-1)!, /Enabled; waiting for a message/);
  h.input(); await flush();
  const request = JSON.parse(String(h.jobs[0]!.context.messages[0]!.content));
  assert.equal(request.nativeLanguage, "pt-BR");
  assert.equal(request.targetLanguage, "en");
  h.event("session_shutdown");
});
test("configuration errors, missing models and skipped-input statuses use English", async () => {
  const h = harness();
  for (const [command, expected] of [
    ["lang not_a_locale", /Enter a valid language code/],
    ["model only-provider", /Use \/polyglot model default or/],
    ["model unknown/model", /Model not found in Pi/],
  ] as const) {
    await h.command(command);
    assert.match(h.notifications.at(-1)!, expected);
  }
  await h.command("on");
  h.input("/skill:test"); await h.command("status");
  assert.match(h.notifications.at(-1)!, /Skipped: command/);
  h.event("user_bash"); await h.command("status");
  assert.match(h.notifications.at(-1)!, /Skipped: shell command/);
  h.event("session_tree"); await h.command("status");
  assert.match(h.notifications.at(-1)!, /Review cleared after session navigation/);
  h.ctx.model = undefined;
  h.input(); await h.command("status");
  assert.match(h.notifications.at(-1)!, /Pi's active model \(none\)/);
  assert.match(h.notifications.at(-1)!, /Review model unavailable/);
  await h.command("off"); await h.command("status");
  assert.match(h.notifications.at(-1)!, /Disabled/);
  h.event("session_shutdown");
});
test("new send clears old feedback; latest completion only; zero edits stays invisible", async () => {
  const h = harness(); await h.command("on"); h.input(); await flush();
  h.jobs[0]!.result.resolve(response(fixtureJSON)); await flush(); assert.ok(h.widget());
  h.input(); assert.equal(h.widget(), undefined); await flush();
  h.input(); await flush(); assert.equal(h.jobs[1]!.options?.signal?.aborted, true);
  h.jobs[2]!.result.resolve(response('{"edits":[]}')); await flush();
  h.jobs[1]!.result.resolve(response(fixtureJSON)); await flush();
  assert.equal(h.widget(), undefined); assert.equal(h.status(), undefined);
  h.event("session_shutdown");
});
test("only interactive prose is reviewed; image data, commands and user shell aren't submitted", async () => {
  const h = harness(); await h.command("on");
  h.input(source, "extension"); h.input(source, "rpc"); h.input("/skill:test"); h.input("`code_only`");
  await flush(); assert.equal(h.jobs.length, 0);
  h.event("input", { type: "input", text: source, source: "interactive", images: [{ data: "SECRET_IMAGE_BYTES" }] });
  await flush(); assert.ok(!JSON.stringify(h.jobs[0]!.context).includes("SECRET_IMAGE_BYTES"));
  h.event("user_bash"); assert.equal(h.jobs[0]!.options?.signal?.aborted, true);
  h.event("session_shutdown");
});
test("language change, disable, tree navigation and shutdown cancel and forbid late UI changes", async () => {
  for (const action of ["off", "lang es", "native fr", "model test/separate", "tree", "shutdown"]) {
    const h = harness(); await h.command("on"); h.input(); await flush();
    if (action === "tree") h.event("session_tree");
    else if (action === "shutdown") h.event("session_shutdown");
    else await h.command(action);
    assert.equal(h.jobs[0]!.options?.signal?.aborted, true, action);
    h.jobs[0]!.result.resolve(response(fixtureJSON)); await flush();
    assert.equal(h.widget(), undefined, action);
    h.event("session_shutdown");
  }
});
test("follows active model at submission; override is independent and default restores following", async () => {
  const h = harness(); await h.command("on");
  await h.command("native es"); await h.command("lang ja");
  h.input(); await flush(); assert.equal(h.jobs[0]!.model, "reviewer");
  const request = JSON.parse(String(h.jobs[0]!.context.messages[0]!.content));
  assert.equal(request.nativeLanguage, "es"); assert.equal(request.targetLanguage, "ja");
  h.ctx.model = { ...model, id: "changed-active" };
  h.input(); await flush(); assert.equal(h.jobs[1]!.model, "changed-active");
  await h.command("model test/separate"); h.input(); await flush(); assert.equal(h.jobs[2]!.model, "separate");
  assert.equal(h.ctx.model.id, "changed-active");
  await h.command("model default"); h.input(); await flush(); assert.equal(h.jobs[3]!.model, "changed-active");
  h.event("session_shutdown");
});
test("removed commands are unavailable, absent from autocomplete and never trigger reviews", async () => {
  const h = harness(); await h.command("on");
  for (const action of ["check " + source, "details", "help"]) {
    assert.deepEqual(h.completions(action.split(" ")[0]!), []);
    await h.command(action); await flush();
    assert.match(h.notifications.at(-1)!, /Unknown command/);
    assert.equal(h.jobs.length, 0);
    assert.equal(h.widget(), undefined);
  }
  h.event("session_shutdown");
});
test("malformed responses show a UI-only diagnostic, not a correction", async () => {
  const h = harness(); await h.command("on"); h.input(); await flush();
  assert.equal(h.jobs.length, 1);
  h.jobs[0]!.result.resolve(response("not JSON")); await flush();
  assert.equal(h.widget(), undefined); assert.ok(h.status());
  await h.command("status"); assert.match(h.notifications.at(-1)!, /invalid edits/);
  await h.command("off"); assert.equal(h.status(), undefined);
});
test("print/RPC/headless mode never reviews or installs TUI components", async () => {
  const h = harness();
  for (const mode of ["print", "json", "rpc"] as const) {
    h.ctx.mode = mode;
    await h.command("on"); h.input(); await flush();
    assert.equal(h.jobs.length, 0); assert.equal(h.widget(), undefined);
  }
});
