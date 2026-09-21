/**
 * THROWAWAY — visual prototype concluded: C4 selected.
 * One sentence with inline edits below the composer; language + change count + hint.
 * Earlier variants remain available as prototype references, not production code.
 * Native TUI adaptation of the UI prototype switcher: /polyglot next.
 * Fixed examples only. No model calls, input interception, or session writes.
 */
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

type Variant = "c" | "c1" | "c2" | "c3" | "c4";
type Language = "en" | "es" | "ja";

type Example = {
  language: string;
  before: string;
  removed: string;
  added: string;
  inlineGap: string; // Visual spacing between edits, not part of the corrected sentence.
  after: string;
  hint: string;
  explanation: string;
  pattern: string;
};

const examples: Record<Language, Example> = {
  en: {
    language: "English",
    before: "Yesterday I ",
    removed: "have fixed",
    added: "fixed",
    inlineGap: " ",
    after: " the login bug.",
    hint: "Com yesterday, use o passado simples.",
    explanation: "Yesterday marca um tempo já encerrado. Use fixed, não have fixed (present perfect).",
    pattern: "Yesterday I fixed… / Last week I shipped…",
  },
  es: {
    language: "Spanish",
    before: "La función ",
    removed: "devuelven",
    added: "devuelve",
    inlineGap: " ",
    after: " una lista.",
    hint: "La función é singular: devuelve.",
    explanation: "O verbo concorda com o sujeito: la función pede devuelve; las funciones pede devuelven.",
    pattern: "La función devuelve… / Las funciones devuelven…",
  },
  ja: {
    language: "Japanese",
    before: "この関数",
    removed: "を",
    added: "は",
    inlineGap: "",
    after: "何を返しますか？",
    hint: "は marca o tópico; を marca o objeto.",
    explanation: "A função é o tópico da pergunta, marcado por は. Em 何を, を marca aquilo que ela retorna.",
    pattern: "この関数は… = Quanto a esta função…",
  },
};

const variants: Variant[] = ["c", "c1", "c2", "c3", "c4"];
const variantNames: Record<Variant, string> = {
  c: "base anterior",
  c1: "inline",
  c2: "colunas",
  c3: "didática",
  c4: "escolhida",
};
const widgetKey = "pi-polyglot-prototype";

function removed(theme: Theme, text: string): string {
  return theme.fg("toolDiffRemoved", theme.strikethrough(text));
}

function added(theme: Theme, text: string): string {
  return theme.fg("toolDiffAdded", theme.underline(text));
}

function wrap(text: string, width: number): string[] {
  return wrapTextWithAnsi(text, Math.max(1, width));
}

// Baseline preserved: original and corrected sentences on separate rows.
export function VariantC(example: Example, theme: Theme, width: number): string[] {
  return [
    theme.fg("accent", `${example.language} · antes / depois`),
    ...wrap(`− ${example.before}${removed(theme, example.removed)}${example.after}`, width),
    ...wrap(`+ ${example.before}${added(theme, example.added)}${example.after}`, width),
    ...wrap(theme.fg("muted", example.hint), width),
  ].map((line) => truncateToWidth(line, width));
}

// One sentence with the edit in place; minimal height and no heading.
export function VariantC1(example: Example, theme: Theme, width: number): string[] {
  return [
    ...wrap(`${example.before}${removed(theme, example.removed)} → ${added(theme, example.added)}${example.after}`, width),
    ...wrap(theme.fg("muted", example.hint), width),
  ].map((line) => truncateToWidth(line, width));
}

// Parallel reading at wider sizes; stacked sections on narrow terminals.
export function VariantC2(example: Example, theme: Theme, width: number): string[] {
  const original = `${example.before}${removed(theme, example.removed)}${example.after}`;
  const corrected = `${example.before}${added(theme, example.added)}${example.after}`;
  const beforeLabel = theme.fg("muted", "− Antes");
  const afterLabel = theme.fg("accent", "+ Depois");
  if (width < 76) {
    return [
      beforeLabel,
      ...wrap(original, width),
      afterLabel,
      ...wrap(corrected, width),
      ...wrap(theme.fg("muted", example.hint), width),
    ].map((line) => truncateToWidth(line, width));
  }

  const leftWidth = Math.floor((width - 3) / 2);
  const rightWidth = width - 3 - leftWidth;
  const left = [beforeLabel, ...wrap(original, leftWidth)];
  const right = [afterLabel, ...wrap(corrected, rightWidth)];
  const lines: string[] = [];
  for (let row = 0; row < Math.max(left.length, right.length); row++) {
    const cell = left[row] ?? "";
    lines.push(
      cell + " ".repeat(Math.max(0, leftWidth - visibleWidth(cell))) +
      theme.fg("borderMuted", " │ ") + (right[row] ?? ""),
    );
  }
  return [...lines, ...wrap(theme.fg("muted", example.hint), width)]
    .map((line) => truncateToWidth(line, width));
}

// Lead with the usable sentence; isolate the change and teaching below it.
export function VariantC3(example: Example, theme: Theme, width: number): string[] {
  return [
    ...wrap(`${theme.fg("success", "✓")} ${example.before}${added(theme, example.added)}${example.after}`, width),
    ...wrap(`${theme.fg("muted", "Ajuste   ")}${removed(theme, example.removed)} → ${added(theme, example.added)}`, width),
    ...wrap(`${theme.fg("accent", "Por quê? ")}${example.explanation}`, width),
    ...wrap(`${theme.fg("accent", "Padrão   ")}${theme.fg("muted", example.pattern)}`, width),
  ].map((line) => truncateToWidth(line, width));
}

// Selected design: language + change count, one marked-up sentence, then the hint.
export function VariantC4(example: Example, theme: Theme, width: number): string[] {
  // Each fixed fixture has a single replacement, not a pair of separate changes.
  const changeCount = example.removed === example.added ? 0 : 1;
  return [
    theme.fg("accent", `${example.language} · ${changeCount} ${changeCount === 1 ? "change" : "changes"}`),
    ...wrap(`${example.before}${removed(theme, example.removed)}${example.inlineGap}${added(theme, example.added)}${example.after}`, width),
    ...wrap(theme.fg("muted", example.hint), width),
  ].map((line) => truncateToWidth(line, width));
}

const renderers = { c: VariantC, c1: VariantC1, c2: VariantC2, c3: VariantC3, c4: VariantC4 };

export default function polyglotPrototype(pi: ExtensionAPI) {
  let enabled = false;
  let variant: Variant = "c4";
  let language: Language = "en";

  function render(ctx: ExtensionContext) {
    if (ctx.mode !== "tui") return;
    // Replace only our own widget; the composer and other extensions stay intact.
    ctx.ui.setWidget(widgetKey, undefined);
    if (!enabled) {
      ctx.ui.setStatus(widgetKey, undefined);
      return;
    }

    ctx.ui.setStatus(
      widgetKey,
      `ON · ${variant.toUpperCase()} ${variantNames[variant]} · ${language} → pt-BR · abaixo · /polyglot next · /polyglot off`,
    );
    ctx.ui.setWidget(widgetKey, (_tui, theme) => ({
      render(width) {
        if (width < 1) return [];
        return renderers[variant](examples[language], theme, width);
      },
      // Stateless rendering recomputes styles with Pi's current theme.
      invalidate() {},
    }), { placement: "belowEditor" });
  }

  const actions = ["on", "off", ...variants, "next", "lang en", "lang es", "lang ja", "help"];
  pi.registerCommand("polyglot", {
    description: "Protótipo visual, sem IA: on/off, c/c1/c2/c3/c4, next, lang en/es/ja",
    getArgumentCompletions(prefix) {
      const matches = actions.filter((action) => action.startsWith(prefix));
      return matches.length ? matches.map((value) => ({ value, label: value })) : null;
    },
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") return;
      const action = args.trim().toLowerCase().replace(/\s+/g, " ");
      switch (action) {
        case "":
          enabled = !enabled;
          break;
        case "on":
          enabled = true;
          break;
        case "off":
          enabled = false;
          break;
        case "c":
        case "c1":
        case "c2":
        case "c3":
        case "c4":
          variant = action;
          enabled = true;
          break;
        case "next":
          variant = variants[(variants.indexOf(variant) + 1) % variants.length]!;
          enabled = true;
          break;
        case "lang en":
        case "lang es":
        case "lang ja":
          language = action === "lang en" ? "en" : action === "lang es" ? "es" : "ja";
          enabled = true;
          break;
        default:
          ctx.ui.notify(
            "DEMO: exemplos fixos, não corrige suas mensagens.\n" +
            "/polyglot — liga/desliga\n" +
            "/polyglot c — base anterior: antes/depois abaixo\n" +
            "/polyglot c1 — alteração dentro da frase\n" +
            "/polyglot c2 — antes/depois em colunas\n" +
            "/polyglot c3 — frase corrigida + explicação\n" +
            "/polyglot c4 — escolhida: frase única com alterações\n" +
            "/polyglot next — próxima variante\n" +
            "/polyglot lang en|es|ja — troca o exemplo\n" +
            "/polyglot off — remove toda a UI do protótipo",
            action === "help" ? "info" : "warning",
          );
          return;
      }
      render(ctx);
    },
  });

  pi.on("session_start", (_event, ctx) => {
    enabled = false;
    variant = "c4";
    language = "en";
    render(ctx);
  });
  pi.on("session_shutdown", (_event, ctx) => {
    enabled = false;
    render(ctx);
  });
}
