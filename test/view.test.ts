import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { visibleWidth } from "@earendil-works/pi-tui";
import { parseReview, prepareInput } from "../src/review.ts";
import { compactLines, renderReview } from "../src/view.ts";
import { defaultPreferences, parseLanguage, parseModel } from "../src/config.ts";
import { fixture, fixtureJSON, source, theme } from "./helpers.ts";

test("chosen C4: one source sentence, strikethrough + underline, native hint and correct count", () => {
  const review = parseReview(fixtureJSON, prepareInput(source)!);
  const lines = renderReview(review, "en", theme, 120);
  const text = stripVTControlCharacters(lines.join("\n"));
  assert.match(text, /English · 1 change/);
  assert.equal(text.split("Yesterday I").length - 1, 1);
  assert.ok(!text.includes("→"));
  assert.match(text, /have fixed/);
  assert.equal(text.split("fixed").length - 1, 1);
  assert.match(text, /Fix:/);
  assert.ok(lines.join("").includes("\x1b[9m")); assert.ok(lines.join("").includes("\x1b[4m"));
  assert.equal(renderReview({ text: source, edits: [] }, "en", theme, 80).length, 0);
});

test("English UI labels do not translate model explanations in another native language", () => {
  const explanation = "Com um tempo passado definido, use o passado simples.";
  const review = parseReview(JSON.stringify({ edits: [{ ...fixture, explanation }] }), prepareInput(source)!);
  const text = stripVTControlCharacters(renderReview(review, "en", theme, 120).join("\n"));
  assert.match(text, /English · 1 change/);
  assert.ok(text.includes(`Fix: ${explanation}`));
});

test("wide anchors from a real-model response do not repeat the sentence prefix", () => {
  const review = parseReview(JSON.stringify({ edits: [{ ...fixture, original: "Yesterday I have fixed", replacement: "Yesterday I fixed" }] }), prepareInput(source)!);
  const text = stripVTControlCharacters(renderReview(review, "en", theme, 120).join("\n"));
  assert.equal(text.split("Yesterday I").length - 1, 1);
  assert.equal(text.split("fixed").length - 1, 1);
});

test("multiple changes share context, count substitutions once, distinguish optional suggestions", () => {
  const text = "Yesterday I have fixed the bug really fast.";
  const review = parseReview(JSON.stringify({ edits: [fixture, { ...fixture, original: "really fast", replacement: "quickly", kind: "naturalness", explanation: "A more concise option, not a required correction." }] }), prepareInput(text)!);
  const output = stripVTControlCharacters(renderReview(review, "en", theme, 140).join("\n"));
  assert.match(output, /2 changes/); assert.match(output, /Suggestion \(optional\)/);
  assert.equal(output.split("Yesterday I").length - 1, 1);
});

test("Unicode, multiline explanations and long excerpts obey width and height budgets", () => {
  for (const text of ["この関数を何を返しますか？", source, "A long paragraph. ".repeat(50) + source + " Another paragraph.".repeat(30)]) {
    const edit = text.includes("この関数") ? { ...fixture, original: "を", replacement: "は" } : fixture;
    const review = parseReview(JSON.stringify({ edits: [edit] }), prepareInput(text)!);

    for (const width of [1, 2, 10, 30, 45, 80, 120]) {
      const lines = renderReview(review, text.includes("この関数") ? "ja" : "en", theme, width);
      assert.ok(lines.every((line) => visibleWidth(line) <= width), `width ${width}`);
      assert.ok(compactLines(lines, width, 24).length <= 8);
    }
  }
});

test("compact feedback indicates truncation without advertising removed commands", () => {
  const lines = compactLines(Array(20).fill("feedback"), 60, 24);
  assert.equal(lines.length, 8);
  assert.equal(lines.at(-1), "… feedback shortened");
  assert.ok(!lines.join("\n").includes("/polyglot"));
});

test("language preferences are independent; model IDs may contain slashes", () => {
  assert.deepEqual(defaultPreferences(), { targetLanguage: "en", nativeLanguage: "en" });
  assert.equal(parseLanguage("pt-br"), "pt-BR"); assert.equal(parseLanguage("fr"), "fr");
  assert.throws(() => parseLanguage("not a language"));
  assert.equal(parseModel("default"), undefined);
  assert.deepEqual(parseModel("openrouter/org/model"), { provider: "openrouter", id: "org/model" });
  assert.throws(() => parseModel("only-provider"));
});
