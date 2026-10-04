import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "./use-media-query";

// The theme: light or dark. It starts from the system's setting; once the visitor flips the switch,
// their choice holds, is remembered in this browser (index.html applies it before the first paint),
// and is set as data-theme on the root, which every themed rule in Atlas and the design system
// answers to.
export type Theme = "light" | "dark";

const KEY = "atlas-theme";

function readHeld(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const [held, setHeld] = useState<Theme | null>(readHeld);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme: Theme = held ?? (prefersDark ? "dark" : "light");

  useEffect(() => {
    if (!held) return;
    document.documentElement.dataset.theme = held;
    try {
      localStorage.setItem(KEY, held);
    } catch {
      // storage can be unavailable (a private window); the choice still holds for this visit
    }
  }, [held]);

  const toggle = useCallback(() => setHeld(theme === "dark" ? "light" : "dark"), [theme]);

  return { theme, toggle };
}
