# pi-polyglot

Learn a language while working with Pi. Get inline corrections and brief explanations below the composer, without interrupting your coding workflow or adding feedback to the coding agent's context.

```text
English · 1 change
Yesterday I have fixed the login bug.
Fix: With “yesterday”, use the simple past.
```

In the terminal, `have ` is **struck through** to indicate its removal. Additions are **underlined**, using your theme's diff colors. Unchanged text appears only once. A replacement counts as one change, not two.

**The interface is in English.** Review explanations follow your configured native language, which defaults to English.

## Try it locally

Requires Pi **0.85.1** (the tested version), with a model and authentication configured. You do not need to install the extension globally:

```sh
npm run dev
```

In the new session:

```text
/polyglot on
```

Write normally in your target language. Your messages reach the coding agent unchanged and are reviewed automatically in parallel.

For example, to practice Spanish with explanations in English:

```text
/polyglot lang es
/polyglot native en
/polyglot on
```

You can also use `/reload` in a session that trusts this project: `.pi/extensions/polyglot.ts` is discovered automatically. If you started a session with the old `npm run prototype`, exit and start a new one with `npm run dev`. Reloading does not replace the extension path passed on the command line.

### Commands

| Command | Effect |
| --- | --- |
| `/polyglot` | Toggle on/off |
| `/polyglot on` / `off` | Enable reviews / cancel the pending review and clear the UI |
| `/polyglot lang en` | Set the target language; accepts codes such as `en-US`, `es`, `fr`, and `ja` |
| `/polyglot native en` | Set the language used for explanations, independently of the target language |
| `/polyglot model default` | Follow Pi's active model at the time of each submission |
| `/polyglot model <provider>/<model-id>` | Use a model already configured in Pi without changing the coding model |
| `/polyglot status` | Show preferences, model, and the latest review status or error |

**Current defaults:** disabled, English as the target language, English for explanations, and Pi's active model. Preferences are **in memory only**. Reloading, restarting, or switching sessions restores these defaults. Setting a language or model does not enable reviews by itself.

The UI language and the explanation language are separate. For example, `/polyglot native pt-BR` requests explanations in Brazilian Portuguese while commands, notifications, and errors remain in English. Changing the target language does not change the explanation language.

## How it works

- The input hook immediately returns `continue`, without waiting for a review, changing text/images, or injecting messages. Pi's normal workflow continues.
- Each review uses `ctx.modelRegistry.complete()` with **a fresh context**, one message, and dedicated review instructions. It reuses Pi's model and authentication resolution, not its conversation history.
- The ephemeral review session is a single-turn request with a new identifier, discarded when it finishes. No coding `AgentSession`, subprocess, or JSONL session is created. We do not use `ctx.newSession()`.
- No tools, skills, extensions, context files, or project history are loaded for the review. The extension does not read referenced files, previous messages, or drafts still being typed.
- By default, the review uses the active model captured at submission. An optional model override affects only reviews; `model default` restores automatic model selection.
- The model is instructed to review only the target language, correct errors, and suggest more natural wording without changing your intent. `Fix` labels corrections; `Suggestion (optional)` labels style suggestions. Explanations use your configured native language.
- Edits must match exact, non-overlapping spans in the message. Invalid output never becomes a correction. Shared words are removed from returned edit pairs to avoid duplicating unchanged text.
- Results appear only in the widget—**never** through `sendMessage`, `sendUserMessage`, the main system prompt, or coding-agent tools.
- Feedback remains until your next submission, with no disappearance timer. A new submission clears the previous feedback and cancels the pending review. Stale responses cannot reappear, even if the provider ignores cancellation.
- When there are no useful changes, nothing appears: no widget, success indicator, or “all good” message.
- Disabling reviews, changing preferences, navigating the session tree, or shutting down/reloading cancels the review and clears the UI.

## Current limits

- **Up to 3 changes**, prioritizing errors, for messages of up to **4,000 characters**. Longer input is skipped to avoid duplicating the cost of large prompts. There is no batch analysis or accumulated queue.
- A local **30-second deadline**, no extension retries, and a requested output limit of **1,800 tokens**. Provider cancellation is cooperative: work already processed may still be billed after cancellation.
- The panel uses at most ten lines or roughly one-third of the terminal height. Long messages show excerpts around edits, with an indicator when feedback is shortened. There is no expanded view or modal.
- Backtick/tilde code fences, inline code, indented lines, URLs, `@file` references, paths, and common identifiers are masked before submission. Images are not sent to the reviewer. This is not a code parser or general secret scrubber: unmarked code also depends on the model following its instructions.
- Slash commands, shell commands (`!`/`!!`), and input from other extensions are ignored. Only interactive TUI mode is supported; print/JSON/RPC modes do not start reviews.
- The model can make mistakes, especially without earlier context. Suggestions are never applied automatically.
- Network failures, timeouts, and invalid JSON do not block Pi or produce fabricated corrections. Only a small status indicator appears; `/polyglot status` explains the issue. The next submission clears it.
- **Reviews make additional provider requests**, consuming tokens or subscription quota. Keeping the main context clean does not make reviews free. The main chat's cost/token counter **does not include** these independent requests.
- The extension does not save preferences, messages, or learning history. Provider-side storage and retention follow the provider's own policies. Existing authentication is managed by Pi.

## Development and validation

```sh
npm install --ignore-scripts
npm run check
```

This checks types and runs tests without real credentials. Tests cover:

- synchronous input pass-through, isolation, and no access to the main session;
- model selection, independent language preferences, and enabling/disabling;
- cancellation, deadlines, reload/shutdown, and out-of-order results;
- JSON validation, protected spans, repeated anchors, and diff normalization;
- change counts, optional suggestions, and Unicode terminal-width limits;
- English UI text and preservation of explanations in the configured native language;
- the real `ModelRegistry` HTTP transport against a local server: the coding request finishes while the review is pending, with separate contexts.

A live smoke check also reviewed a synthetic sentence in the TUI using `openai-codex/gpt-6-astra`, with explanations configured in Portuguese, without starting a coding-agent turn.

### Layout

- `src/extension.ts`: Pi events, commands, and UI integration.
- `src/review.ts`: isolated context, protected spans, edit validation and normalization.
- `src/latest-review.ts`: deadlines, cancellation, and latest-result-only publication.
- `src/view.ts`: single-sentence inline diff and bounded feedback panel.
- `src/config.ts`: language and model selection.

## Archived prototype

The throwaway visual prototype and original decisions are preserved on the local **`prototype/visual`** branch, commit `74082e5`. The implementation was rewritten on `main`; the old variants are not loaded by the functional extension. The archive is a historical snapshot and retains its original language.

```sh
git show prototype/visual:prototypes/pi-polyglot-visual.ts
```

The selected design is C4: below the composer, an `English · N changes` header, removed text struck through, added text underlined, and a single marked-up sentence with explanations in the user's native language. No “polyglot · DEMO” label, duplicated before/after sentences, or automatic prompt rewriting.

## Next steps

Preference persistence, configurable limits, and teaching refinements can follow real-world use. This version does not keep learning history or assess proficiency levels.
