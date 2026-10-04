import Icon from "./Icon";
import type { Theme } from "@/hooks/use-theme";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

// A small switch, sun on the left and moon on the right; the thumb sits under the current theme.
// It is a switch to assistive tech too: "Dark theme", on or off.
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={theme === "dark"} aria-label="Dark theme" className="theme-toggle" onClick={onToggle}>
      <span className="theme-toggle-thumb" aria-hidden="true" />
      <span className="theme-toggle-icon" aria-hidden="true">
        <Icon name="sun" weight="bold" size={12} />
      </span>
      <span className="theme-toggle-icon" aria-hidden="true">
        <Icon name="moon" weight="bold" size={12} />
      </span>
    </button>
  );
}
