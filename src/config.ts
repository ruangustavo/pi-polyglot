import type { Languages } from "./review.ts";

export type Preferences = Languages & { model?: { provider: string; id: string } };
export function defaultPreferences(): Preferences {
  return { targetLanguage: "en", nativeLanguage: "en" };
}

const names = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
export function languageName(locale: string): string {
  return names.of(locale) ?? locale;
}
export function parseLanguage(value: string): string {
  try {
    const [locale] = Intl.getCanonicalLocales(value);
    if (locale && names.of(locale)) return locale;
  } catch { /* Report a short, actionable error below. */ }
  throw new Error("Enter a valid language code, such as en, pt-BR, es, or ja.");
}
export function parseModel(value: string): Preferences["model"] {
  if (value === "default") return undefined;
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1 || /\s/u.test(value)) {
    throw new Error("Use /polyglot model default or /polyglot model provider/model-id.");
  }
  return { provider: value.slice(0, slash), id: value.slice(slash + 1) };
}
