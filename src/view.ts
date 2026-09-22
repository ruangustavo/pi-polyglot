import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { languageName } from "./config.ts";
import type { Edit, Review } from "./review.ts";

function gap(edit: Edit): string {
  // Separate adjacent word annotations, but not Japanese/Chinese characters or punctuation.
  const last = Array.from(edit.original).at(-1) ?? "";
  const first = Array.from(edit.replacement)[0] ?? "";
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  return /[\p{L}\p{N}]/u.test(last) && /[\p{L}\p{N}]/u.test(first) && !(cjk.test(last) && cjk.test(first)) ? " " : "";
}

/** Only include context near edits in long messages, never duplicate before/after. */
export function renderReview(review: Review, targetLanguage: string, theme: Theme, width: number): string[] {
  if (width < 1 || review.edits.length === 0) return [];
  const ranges: { start: number; end: number }[] = [];
  for (const edit of review.edits) {
    let start = review.text.length <= 240 ? 0 : Math.max(0, edit.start - 48);
    let end = review.text.length <= 240 ? review.text.length : Math.min(review.text.length, edit.end + 48);
    // Do not cut a surrogate pair at an excerpt boundary.
    if (/[\uDC00-\uDFFF]/u.test(review.text[start] ?? "")) start--;
    if (/[\uDC00-\uDFFF]/u.test(review.text[end] ?? "")) end++;
    const previous = ranges.at(-1);
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
  }
  const wrap = (text: string) => wrapTextWithAnsi(text.replace(/\r\n?/g, "\n").replace(/\t/g, "  "), width);
  const count = review.edits.length;
  const lines = [theme.fg("accent", `${languageName(targetLanguage)} · ${count} ${count === 1 ? "change" : "changes"}`)];
  for (const range of ranges) {
    let cursor = range.start;
    let sentence = range.start > 0 ? "…" : "";
    review.edits.forEach((edit, index) => {
      if (edit.start < range.start || edit.end > range.end) return;
      sentence += review.text.slice(cursor, edit.start);
      sentence += theme.fg("toolDiffRemoved", theme.strikethrough(edit.original));
      sentence += gap(edit) + theme.fg("toolDiffAdded", theme.underline(edit.replacement));
      if (count > 1) sentence += theme.fg("muted", `[${index + 1}]`);
      cursor = edit.end;
    });
    sentence += review.text.slice(cursor, range.end) + (range.end < review.text.length ? "…" : "");
    lines.push(...wrap(sentence));
  }
  review.edits.forEach((edit, index) => {
    const label = edit.kind === "error" ? "Fix" : "Suggestion (optional)";
    lines.push(...wrap(theme.fg("muted", `${count > 1 ? `[${index + 1}] ` : ""}${label}: ${edit.explanation}`)));
  });
  return lines.map((line) => truncateToWidth(line, width));
}

export function compactLines(lines: string[], width: number, terminalRows: number): string[] {
  const limit = Math.max(3, Math.min(10, Math.floor(terminalRows / 3)));
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit - 1), truncateToWidth("… feedback shortened", width)];
}
