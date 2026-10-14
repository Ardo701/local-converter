export type Locale = "fr" | "en";

export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

/** localStorage key, also read by the inline script in app/layout.tsx. */
export const LOCALE_KEY = "lang";

/** A user-facing value: the same in every language, or one per language. */
export type Localized = string | Record<Locale, string>;

export function localize(value: Localized, locale: Locale): string {
  return typeof value === "string" ? value : value[locale];
}

/**
 * Thrown by converters so the interface can show the message in whichever
 * language the reader picks, even after the failure.
 */
export class LocalizedError extends Error {
  readonly text: Record<Locale, string>;

  constructor(text: Record<Locale, string>) {
    super(text[DEFAULT_LOCALE]);
    this.name = "LocalizedError";
    this.text = text;
  }
}
