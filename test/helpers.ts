import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";
import type { Theme } from "@earendil-works/pi-coding-agent";

/** Fail loudly if production code tries an undeclared capability (e.g. history access). */
export function strictFake<T extends object>(members: Partial<T>): T {
  // SAFETY: the proxy rejects every member not explicitly supplied by the test fixture.
  return new Proxy(members, {
    get(target, key) {
      if (key in target) return Object.getOwnPropertyDescriptor(target, key)?.value;
      throw new Error(`Unexpected capability: ${String(key)}`);
    },
  }) as T;
}

export const model: Model<Api> = {
  api: "openai-completions", provider: "test", id: "reviewer", name: "Reviewer",
  baseUrl: "http://127.0.0.1", reasoning: false, input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 2000,
};

export function response(text: string, stopReason: AssistantMessage["stopReason"] = "stop"): AssistantMessage {
  return { role: "assistant", api: model.api, provider: model.provider, model: model.id,
    content: [{ type: "text", text }], stopReason, timestamp: Date.now(),
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
}

export const fixture = {
  original: "have fixed", replacement: "fixed", occurrence: 1, kind: "error",
  explanation: "With a finished past time, use the simple past.",
};

export const source = "Yesterday I have fixed the login bug.";

export const fixtureJSON = JSON.stringify({ edits: [fixture] });

export const theme = strictFake<Theme>({
  fg: (_color, text) => `\x1b[32m${text}\x1b[39m`,
  underline: (text) => `\x1b[4m${text}\x1b[24m`,
  strikethrough: (text) => `\x1b[9m${text}\x1b[29m`,
});

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });

  return { promise, resolve, reject };
}

export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
