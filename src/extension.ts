import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { defaultPreferences, languageName, parseLanguage, parseModel } from "./config.ts";
import { LatestReview } from "./latest-review.ts";
import { MAX_INPUT_CHARS, prepareInput, reviewText } from "./review.ts";
import { compactLines, renderReview } from "./view.ts";

const WIDGET = "pi-polyglot";

export default function polyglot(pi: ExtensionAPI) {
  let enabled = false;
  let preferences = defaultPreferences();
  let lastState = "No reviews yet.";
  const runner = new LatestReview();

  function clear(ctx: ExtensionContext) {
    runner.cancel();

    if (ctx.mode !== "tui") return;
    ctx.ui.setWidget(WIDGET, undefined);
    ctx.ui.setStatus(WIDGET, undefined);
  }

  function start(text: string, ctx: ExtensionContext) {
    clear(ctx);
    const input = prepareInput(text);

    if (!input) {
      lastState = `Skipped: command, code, empty/unsafe input, or text over ${MAX_INPUT_CHARS} characters.`;

      return;
    }

    const override = preferences.model;
    const selected = override ? ctx.modelRegistry.find(override.provider, override.id) : ctx.model;

    if (!selected) {
      lastState = "Review model unavailable. Select one with /model or /polyglot model.";
      ctx.ui.setStatus(WIDGET, ctx.ui.theme.fg("warning", "polyglot: see /polyglot status"));

      return;
    }

    // Capture model and languages now; later /model changes affect only new messages.
    const model = { ...selected };
    const languages = { targetLanguage: preferences.targetLanguage, nativeLanguage: preferences.nativeLanguage };
    lastState = `Reviewing with ${model.provider}/${model.id}.`;
    runner.start(
      (signal) => reviewText(ctx.modelRegistry, model, languages, input, signal),
      (review) => {
        lastState = review.edits.length ? `${review.edits.length} ${review.edits.length === 1 ? "change" : "changes"} · ${model.provider}/${model.id}.` : "No useful changes.";

        if (review.edits.length === 0) return;
        ctx.ui.setWidget(WIDGET, (tui, theme) => ({
          render(width) {
            return compactLines(renderReview(review, languages.targetLanguage, theme, width), width, tui.terminal.rows);
          },
          invalidate() {},
        }), { placement: "belowEditor" });
      },
      (error) => {
        lastState = error.message;
        ctx.ui.setStatus(WIDGET, ctx.ui.theme.fg("warning", "polyglot: review unavailable (/polyglot status)"));
      },
    );
  }

  // Synchronous pass-through. Never await the model, rewrite input, or inject messages.
  pi.on("input", (event, ctx) => {
    if (ctx.mode === "tui" && enabled && event.source === "interactive") start(event.text, ctx);

    return { action: "continue" };
  });
  pi.on("user_bash", (_event, ctx) => {
    if (enabled) { clear(ctx); lastState = "Skipped: shell command."; }
  });
  pi.on("session_tree", (_event, ctx) => { clear(ctx); lastState = "Review cleared after session navigation."; });
  pi.on("session_start", (_event, ctx) => {
    enabled = false;
    preferences = defaultPreferences();
    clear(ctx);
    lastState = "No reviews yet.";
  });
  pi.on("session_shutdown", (_event, ctx) => { enabled = false; clear(ctx); });

  const completions = ["on", "off", "status", "lang en", "lang es", "lang ja", "native en", "native pt-BR", "model default"];
  pi.registerCommand("polyglot", {
    description: "Isolated language feedback: on/off, lang, native, model, status",
    getArgumentCompletions(prefix) {
      return completions.flatMap((value) => value.startsWith(prefix) ? [{ value, label: value }] : []);
    },
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") return;
      const trimmed = args.trim();
      const [action = "", ...rest] = trimmed.split(/\s+/u);
      const value = rest.join(" ");

      if ((action === "" || action === "on" || action === "off") && !value) {
        enabled = action === "" ? !enabled : action === "on";
        clear(ctx);
        lastState = enabled ? "Enabled; waiting for a message." : "Disabled.";

        if (enabled) ctx.ui.notify(`Polyglot on: ${languageName(preferences.targetLanguage)}; explanations in ${languageName(preferences.nativeLanguage)}. Each review uses an additional model call.`, "info");

        return;
      }

      if (action === "status" && !value) {
        const model = preferences.model ? `${preferences.model.provider}/${preferences.model.id}` : `Pi's active model (${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "none"})`;
        ctx.ui.notify(`${enabled ? "ON" : "OFF"} · ${languageName(preferences.targetLanguage)}\nNative language: ${languageName(preferences.nativeLanguage)}\nModel: ${model}\n${lastState}\nPreferences are in memory; /reload resets Polyglot to off.`, "info");

        return;
      }

      if (["lang", "native", "model"].includes(action) && value) {
        try {
          if (action === "model") {
            const model = parseModel(value);

            if (model && !ctx.modelRegistry.find(model.provider, model.id)) throw new Error("Model not found in Pi. Use provider/model-id or default.");
            preferences = { ...preferences, model };
          } else {
            const locale = parseLanguage(value);
            preferences = { ...preferences, [action === "lang" ? "targetLanguage" : "nativeLanguage"]: locale };
          }

          clear(ctx);
          lastState = "Preferences updated; waiting for the next message.";
          ctx.ui.notify("Preference updated. Use /polyglot status to view your settings.", "info");
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : "Invalid configuration.", "warning");
        }

        return;
      }

      ctx.ui.notify(
        "Unknown command. Use /polyglot with on, off, status, lang, native, or model.",
        "warning",
      );
    },
  });
}
