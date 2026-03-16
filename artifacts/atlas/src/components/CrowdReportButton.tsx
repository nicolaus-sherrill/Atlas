import { useState } from "react";
import { BUSYNESS_LEVELS, submitCrowdReport } from "@/lib/crowd";

interface CrowdReportButtonProps {
  spotId: string;
  onReported?: () => void;
}

export default function CrowdReportButton({ spotId, onReported }: CrowdReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (level: number) => {
    setSubmitting(true);
    const ok = await submitCrowdReport(spotId, level);
    setSubmitting(false);
    if (ok) {
      setSubmitted(true);
      setIsOpen(false);
      onReported?.();
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  if (submitted) {
    return (
      <div className="crowd-report-success">
        <span className="crowd-check">&#10003;</span> Report submitted
      </div>
    );
  }

  return (
    <div className="crowd-report-wrapper">
      <button
        className="crowd-report-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={submitting}
      >
        <span className="crowd-icon">&#128101;</span>
        {isOpen ? "Cancel" : "Report crowd level"}
      </button>
      {isOpen && (
        <div className="crowd-level-picker">
          {BUSYNESS_LEVELS.map((b) => (
            <button
              key={b.level}
              className="crowd-level-option"
              onClick={() => handleSubmit(b.level)}
              disabled={submitting}
              style={{ borderLeftColor: b.color }}
            >
              <span className="crowd-dot" style={{ background: b.color }} />
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
