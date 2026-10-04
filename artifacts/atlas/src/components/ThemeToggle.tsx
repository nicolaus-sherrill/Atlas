import Icon from "./Icon";
import type { ThemeChoice } from "@/hooks/use-theme";

interface ThemeToggleProps {
  choice: ThemeChoice;
  onCycle: () => void;
}

const LABEL: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON = { system: "circle-half", light: "sun", dark: "moon" } as const;

// A quiet switch in the footer line: an icon and the current theme in label text, stepping through
// System, Light and Dark. It stays out of the way of the map and the list on purpose.
export default function ThemeToggle({ choice, onCycle }: ThemeToggleProps) {
  const next = choice === "system" ? "light" : choice === "light" ? "dark" : "system";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onCycle}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]}`}
    >
      <Icon name={ICON[choice]} weight="bold" size={16} />
      <span>{LABEL[choice]}</span>
    </button>
  );
}
