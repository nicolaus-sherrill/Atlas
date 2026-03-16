import { useState, useRef, useEffect } from "react";

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  formatTrigger?: (selected: Set<string>) => string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
  formatTrigger,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const triggerText = formatTrigger
    ? formatTrigger(selected)
    : selected.size === 0
      ? `${label} ▾`
      : selected.size <= 2
        ? `${Array.from(selected).join(", ")} ▾`
        : `${selected.size} ${label.toLowerCase().endsWith("s") ? label.toLowerCase() : label.toLowerCase() + "s"} ▾`;

  const hasSelection = selected.size > 0;

  return (
    <div className="dropdown-multi" ref={ref}>
      <button
        type="button"
        className={`dropdown-trigger ${hasSelection ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerText}
      </button>
      {open && (
        <div className="dropdown-panel">
          {options.map((opt) => (
            <label key={opt} className="dropdown-item">
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => onToggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
