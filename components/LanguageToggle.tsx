"use client";

import type { Locale } from "@/lib/i18n";
import { useLocale } from "./LocaleProvider";

/* Each language is named in itself, so a reader who cannot read the current
   one still finds theirs. */
const OPTIONS: { id: Locale; label: string; title: string }[] = [
  { id: "fr", label: "FR", title: "Français" },
  { id: "en", label: "EN", title: "English" },
];

export default function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="radiogroup"
      aria-label={t({ fr: "Langue", en: "Language" })}
      className="lang-switch flex items-stretch overflow-hidden rounded-[3px] border border-edge"
    >
      {OPTIONS.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          lang={option.id}
          data-locale={option.id}
          aria-checked={locale === option.id}
          title={option.title}
          onClick={() => setLocale(option.id)}
          className={`label px-1 py-1 text-muted sm:px-2 transition-colors hover:text-ink ${
            index > 0 ? "border-l border-edge" : ""
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
