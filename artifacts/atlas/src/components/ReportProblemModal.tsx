import { createPortal } from "react-dom";
import { useState } from "react";
import { REPORT_REASON_LABELS, reportProblem, type ReportReason } from "@/lib/contributions";
import type { WorkSpot } from "@/lib/types";

interface ReportProblemModalProps {
  spot: WorkSpot;
  onClose: () => void;
  onSent: () => void;
}

export default function ReportProblemModal({ spot, onClose, onSent }: ReportProblemModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await reportProblem(spot.id, reason, details);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
      setSending(false);
    }
  };

  return createPortal(
    <div className="browse-modal-backdrop" onClick={onClose}>
      <div className="browse-modal" onClick={(e) => e.stopPropagation()}>
        <form className="spot-form" onSubmit={submit}>
          <div className="spot-form-header">
            <h2>Report a problem</h2>
            <button type="button" className="spot-form-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
          <p className="modal-intro">What's wrong with {spot.name}? An admin will take a look.</p>

          <fieldset className="form-group report-reasons">
            <legend>Reason</legend>
            {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
              <label key={r} className={`report-reason ${reason === r ? "active" : ""}`}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                {REPORT_REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>

          {reason === "wrong_info" && (
            <p className="modal-hint">If you know the right details, "Suggest an edit" lets you fix them directly.</p>
          )}

          <div className="form-group">
            <label htmlFor="report-details">Details (optional)</label>
            <textarea
              id="report-details"
              rows={3}
              maxLength={1000}
              placeholder={reason === "duplicate" ? "Which listing is it a duplicate of?" : "Anything that helps us check"}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          {error && <p className="modal-error">{error}</p>}
          <button type="submit" className="btn-submit" disabled={!reason || sending}>
            {sending ? "Sending..." : "Send report"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
