import { DAYS_OF_WEEK, DAY_LABELS, DEFAULT_OPERATING_HOURS, type DayOfWeek, type OperatingHours } from "@/lib/types";

interface HoursEditorProps {
  value: OperatingHours | null;
  onChange: (value: OperatingHours | null) => void;
}

// Weekly opening hours, one row per day. "Hours unknown" clears them, which is better than a guess.
export default function HoursEditor({ value, onChange }: HoursEditorProps) {
  if (!value) {
    return (
      <div className="hours-editor-empty">
        <span>Hours unknown</span>
        <button type="button" className="browse-detail-link-btn" onClick={() => onChange({ ...DEFAULT_OPERATING_HOURS })}>
          Add hours
        </button>
      </div>
    );
  }

  const setDay = (day: DayOfWeek, patch: Partial<OperatingHours[DayOfWeek]>) =>
    onChange({ ...value, [day]: { ...value[day], ...patch } });

  return (
    <div className="hours-editor">
      {DAYS_OF_WEEK.map((day) => {
        const h = value[day];
        return (
          <div key={day} className="hours-editor-row">
            <span className="hours-editor-day">{DAY_LABELS[day]}</span>
            <label className="hours-editor-closed">
              <input type="checkbox" checked={h.closed} onChange={(e) => setDay(day, { closed: e.target.checked })} />
              Closed
            </label>
            <input
              type="time"
              aria-label={`${DAY_LABELS[day]} opens`}
              value={h.open}
              disabled={h.closed}
              onChange={(e) => setDay(day, { open: e.target.value })}
            />
            <span className="hours-editor-to">to</span>
            <input
              type="time"
              aria-label={`${DAY_LABELS[day]} closes`}
              value={h.close}
              disabled={h.closed}
              onChange={(e) => setDay(day, { close: e.target.value })}
            />
          </div>
        );
      })}
      <button type="button" className="hours-editor-clear" onClick={() => onChange(null)}>
        Mark hours as unknown
      </button>
    </div>
  );
}
