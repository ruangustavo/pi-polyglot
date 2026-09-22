import assert from "node:assert/strict";
import { test } from "node:test";
import type { Context } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { MAX_INPUT_CHARS, parseReview, prepareInput, REVIEW_SYSTEM_PROMPT, reviewText } from "../src/review.ts";
import { fixture, fixtureJSON, model, response, source } from "./helpers.ts";

function input(text = source) {
  const result = prepareInput(text);
  assert.ok(result);

  return result;
}

test("skips commands, blank/code-only/unsafe/oversized inputs", () => {
  for (const text of ["", "  ", "/skill:foo", "!!ls", "`const x = 2`", "```ts\nsecret()\n```", "~~~\nsecret()\n~~~", "    const secret = 4", "\x1b[2Jhello", "x".repeat(MAX_INPUT_CHARS + 1)]) {
    assert.equal(prepareInput(text), undefined, JSON.stringify(text));
  }
});

test("masks code, identifiers, URLs and file references without changing offsets", () => {
  const text = "Please explain `secret_key` in @private.env at https://example.test.\n```js\nPASSWORD = 42;\n```\nThen use calculateTotal and user_name.";
  const prepared = input(text);
  assert.equal(prepared.masked.length, text.length);
  assert.equal(prepared.text, text);

  for (const value of ["secret_key", "private.env", "https://", "PASSWORD", "calculateTotal", "user_name"]) assert.ok(!prepared.masked.includes(value));
  assert.ok(prepared.masked.startsWith("Please explain"));
  assert.ok(!input("Explain this:\n```js\nsecret()").masked.includes("secret()"));
});

test("exact edits and explanations, not a full rewritten message", () => {
  const result = parseReview(fixtureJSON, input());
  assert.equal(result.text, source);
  assert.deepEqual(result.edits, [{ start: 12, end: 17, original: "have ", replacement: "", kind: "error", explanation: fixture.explanation }]);
  assert.deepEqual(parseReview('{"edits":[]}', input()).edits, []);
  assert.equal(parseReview('```json\n' + fixtureJSON + '\n```', input()).edits.length, 1);
});

test("repeated anchors, insertion anchors and deletions", () => {
  const result = parseReview(JSON.stringify({ edits: [{ ...fixture, original: "word", replacement: "words", occurrence: 2 }] }), input("word word"));
  assert.equal(result.edits[0]?.start, 5);

  for (const replacement of ["a word", ""]) {
    const [edit] = parseReview(JSON.stringify({ edits: [{ ...fixture, original: "word", replacement }] }), input("word")).edits;
    assert.ok(edit);
    assert.equal("word".slice(0, edit.start) + edit.replacement + "word".slice(edit.end), replacement);
  }
});

test("broad model anchors do not duplicate unchanged words; whole words stay readable", () => {
  const [edit] = parseReview(JSON.stringify({ edits: [{ ...fixture, original: "Yesterday I have fixed", replacement: "Yesterday I fixed" }] }), input()).edits;
  assert.equal(edit?.original, "have ");
  assert.equal(edit?.replacement, "");
  const [spanish] = parseReview(JSON.stringify({ edits: [{ ...fixture, original: "devuelven", replacement: "devuelve" }] }), input("La función devuelven una lista.")).edits;
  assert.equal(spanish?.original, "devuelven");
  assert.equal(spanish?.replacement, "devuelve");
});

test("fails closed for malformed, overlapping, unsafe, missing and protected edits", () => {
  const invalid = ["garbage", "null", "{}", '{"edits":{}}',
    ...[
      { ...fixture, original: "absent" }, { ...fixture, original: "" },
      { ...fixture, replacement: fixture.original }, { ...fixture, replacement: "\x1b[2J" },
      { ...fixture, explanation: "\u202ehidden" }, { ...fixture, kind: "other" },
      { ...fixture, occurrence: 0 }, { ...fixture, occurrence: 1.2 },
      { ...fixture, occurrence: 999999999 }, { ...fixture, explanation: "x".repeat(221) },
    ].map((edit) => JSON.stringify({ edits: [edit] })),
    JSON.stringify({ edits: [fixture, fixture] }), JSON.stringify({ edits: Array(4).fill(fixture) })];

  for (const raw of invalid) assert.throws(() => parseReview(raw, input()));
  assert.throws(() => parseReview(JSON.stringify({ edits: [{ ...fixture, original: "secret", replacement: "public" }] }), input("Explain `secret`")));
  assert.throws(() => parseReview(JSON.stringify({ edits: [{ ...fixture, original: "Explain         ", replacement: "Other" }] }), input("Explain `secret`")));
});

test("rejects split Unicode graphemes and invalid surrogate replacements", () => {
  for (const [text, edit] of [
    ["e\u0301", { ...fixture, original: "e", replacement: "a" }],
    [source, { ...fixture, replacement: "\ud83d" }],
  ] as const) {
    assert.throws(() => parseReview(JSON.stringify({ edits: [edit] }), input(text)));
  }
});

test("rejects ambiguous zero-width insertions at the same position", () => {
  const edit = { ...fixture, original: "word", replacement: "a word" };
  assert.throws(() => parseReview(JSON.stringify({ edits: [edit, edit] }), input("word")));
});

test("each call owns one new context with no tools, transcript, history or shared session ID", async () => {
  const calls: { context: Context; options: unknown }[] = [];

  const registry: Pick<ModelRegistry, "complete"> = { complete: async (selected, context, options) => {
    assert.equal(selected, model);
    assert.equal(options?.maxRetries, 0);
    assert.equal(options?.signal?.aborted, false);
    calls.push({ context, options });

    return response(fixtureJSON);
  } };

  const language = { targetLanguage: "en", nativeLanguage: "pt-BR" };

  for (let index = 0; index < 2; index++) await reviewText(registry, model, language, input(), new AbortController().signal);
  assert.notEqual(calls[0]!.context, calls[1]!.context);

  for (const { context, options } of calls) {
    assert.equal(context.systemPrompt, REVIEW_SYSTEM_PROMPT);
    assert.equal(context.messages.length, 1);
    assert.equal(context.messages[0]!.role, "user");
    assert.deepEqual(context.tools, []);
    assert.deepEqual(JSON.parse(String(context.messages[0]!.content)), { ...language, text: source });
    assert.ok(!JSON.stringify(options).includes("parent"));
  }

  assert.notDeepEqual(calls[0]!.options, calls[1]!.options);
});

test("protected content never reaches the provider; provider failures don't leak its error", async () => {
  const prepared = input(source + " `private-key` ");
  await reviewText({ complete: async (_model, context) => {
    assert.ok(!JSON.stringify(context).includes("private-key"));

    return response(fixtureJSON);
  } }, model, { targetLanguage: "en", nativeLanguage: "pt-BR" }, prepared, new AbortController().signal);

  for (const stop of ["length", "error", "aborted", "toolUse"] as const) {
    await assert.rejects(reviewText({ complete: async () => response("secret provider diagnostic", stop) }, model, { targetLanguage: "en", nativeLanguage: "pt" }, input(), new AbortController().signal), /did not complete a valid review/);
  }

  await assert.rejects(reviewText({ complete: async () => { throw new Error("TOKEN=secret"); } }, model, { targetLanguage: "en", nativeLanguage: "pt" }, input(), new AbortController().signal), (error: Error) => !error.message.includes("secret"));
});

test("aborted requests don't start or publish", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(reviewText({ complete: async () => { assert.fail("Should not call provider"); } }, model, { targetLanguage: "en", nativeLanguage: "pt" }, input(), controller.signal));
});
