import { useEffect, useState } from "react";
import { fetchMyRating, submitRating } from "@/lib/ratings";
import { EMPTY_SCORES, SCORE_CATEGORIES, type CategoryScores, type ScoreCategory } from "@/lib/types";

interface RateSpotProps {
  spotId: string;
  // Called after a rating saves, so the spot's new average can be loaded
  onRated: () => void;
}

// Lets anyone add their rating to a spot, or change the one they gave. One rating per person.
export default function RateSpot({ spotId, onRated }: RateSpotProps) {
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<CategoryScores>({ ...EMPTY_SCORES });
  const [hasRated, setHasRated] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyRating(spotId).then((mine) => {
      if (cancelled || !mine) return;
      setScores(mine);
      setHasRated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [spotId]);

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      await submitRating(spotId, scores);
      setHasRated(true);
      setStatus("saved");
      setOpen(false);
      onRated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("Too many") ? "You've rated a lot of spots this hour. Try again later." : "Couldn't save your rating. Try again.");
      setStatus("error");
    }
  };

  if (!open) {
    return (
      <div className="rate-spot">
        <button type="button" className="browse-detail-link-btn" onClick={(e) => { e.stopPropagation(); setOpen(true); setStatus("idle"); }}>
          {hasRated ? "Change your rating" : "Rate this spot"}
        </button>
        {status === "saved" && <span className="rate-spot-note">Thanks. Your rating is in the average.</span>}
      </div>
    );
  }

  return (
    <div className="rate-spot rate-spot-open" onClick={(e) => e.stopPropagation()}>
      <div className="score-categories">
        {SCORE_CATEGORIES.map((sc) => (
          <div key={sc.key} className="score-category-row">
            <span className="score-category-name">{sc.label}</span>
            <span className="score-dots-input">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`score-dot-char ${scores[sc.key as ScoreCategory] >= v ? "filled" : ""}`}
                  onClick={() => setScores((prev) => ({ ...prev, [sc.key]: v }))}
                  aria-label={`${sc.label} ${v} of 5`}
                  aria-pressed={scores[sc.key as ScoreCategory] === v}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      {error && <p className="rate-spot-error">{error}</p>}
      <div className="rate-spot-actions">
        <button type="button" className="browse-detail-map-btn" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : hasRated ? "Update rating" : "Submit rating"}
        </button>
        <button type="button" className="browse-detail-link-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
