import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "./use-media-query";

// The theme: follow the system, or hold light or dark. A held choice is remembered in this browser
// (index.html applies it before the first paint) and set as data-theme on the root, which every
// themed rule in Atlas and the design system answers to.
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "atlas-theme";

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved: "light" | "dark" = choice === "system" ? (prefersDark ? "dark" : "light") : choice;

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    try {
      if (choice === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // storage can be unavailable (a private window); the choice still holds for this visit
    }
  }, [choice]);

  // One control steps through them: system, then light, then dark
  const cycle = useCallback(() => {
    setChoice((c) => (c === "system" ? "light" : c === "light" ? "dark" : "system"));
  }, []);

  return { choice, resolved, cycle };
}
