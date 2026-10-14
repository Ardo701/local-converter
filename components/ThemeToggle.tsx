"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

const MODES: { id: Mode; label: string; title: string }[] = [
  { id: "system", label: "Auto", title: "Suivre le réglage du système" },
  { id: "light", label: "Clair", title: "Forcer le mode clair" },
  { id: "dark", label: "Sombre", title: "Forcer le mode sombre" },
];

/* Kept in sync with --color-paper in globals.css: the colour the browser
   paints its own chrome with. */
const BAR: Record<"light" | "dark", string> = {
  light: "#f4f2ec",
  dark: "#14130f",
};

function readStored(): Mode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage disabled — the toggle still works for this visit.
  }
  return "system";
}

const OVERRIDE_ID = "theme-color-override";

/* In Auto the two media-scoped tags from the layout are the right answer: they
   follow the system with no script at all. A forced theme adds one unscoped
   tag ahead of them, since the browser uses the first match. The layout's
   tags are left alone: React owns them, and removing them makes its next
   update of the head crash. */
function writeBarColour(mode: Mode) {
  let tag = document.getElementById(OVERRIDE_ID) as HTMLMetaElement | null;
  if (mode === "system") {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.id = OVERRIDE_ID;
    tag.name = "theme-color";
  }
  tag.content = BAR[mode];
  document.head.prepend(tag);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMode(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    // Before the stored choice is known, the inline script in the layout owns
    // the attribute — touching it here would flash the wrong theme.
    if (!ready) return;
    const root = document.documentElement;
    if (mode === "system") delete root.dataset.theme;
    else root.dataset.theme = mode;
    writeBarColour(mode);
  }, [mode, ready]);

  function choose(next: Mode) {
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Nothing to persist to; the choice lasts until reload.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      className="theme-switch flex items-stretch overflow-hidden rounded-[3px] border border-edge"
    >
      {MODES.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          data-mode={option.id}
          aria-checked={mode === option.id}
          title={option.title}
          onClick={() => choose(option.id)}
          className={`label px-1.5 py-1 text-muted sm:px-2 transition-colors hover:text-ink ${
            index > 0 ? "border-l border-edge" : ""
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
