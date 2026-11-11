import { useEffect, useState } from "react";
import { fetchMyRating, submitRating } from "@/lib/ratings";
import { SCORE_CATEGORY_LABELS, missingCriteria, type CategoryScores, type RatedPlace } from "@/lib/types";
import RatingRows from "./RatingRows";

interface RateSpotProps {
  spotId: string;
  // The kind of place and what it is good for decide which criteria may be left blank
  place: RatedPlace;
  // Called after a rating saves, so the spot's new average can be loaded
  onRated: () => void;
}

// Lets anyone add their rating to a spot, or change the one they gave. One rating per person.
export default function RateSpot({ spotId, place, onRated }: RateSpotProps) {
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<CategoryScores>({});
  const [hasRated, setHasRated] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyRating(spotId).then((mine) => {
      if (cancelled || !mine) return;
      // An older rating may carry a rated hours number, which no longer counts
      const { hours: _hours, ...rated } = mine as CategoryScores & { hours?: number };
      setScores(rated);
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

  const missing = missingCriteria(place, scores);

  if (!open) {
    return (
      <div className="rate-spot">
        <button type="button" className="btn-solid" onClick={(e) => { e.stopPropagation(); setOpen(true); setStatus("idle"); }}>
          {hasRated ? "Change your rating" : "Rate this spot"}
        </button>
        {status === "saved" && <span className="rate-spot-note">Thanks. Your rating is in the average.</span>}
      </div>
    );
  }

  return (
    <div className="rate-spot rate-spot-open" onClick={(e) => e.stopPropagation()}>
      <RatingRows place={place} scores={scores} onChange={setScores} />
      {missing.length > 0 && <p className="rate-spot-note">Still to rate: {missing.map((k) => SCORE_CATEGORY_LABELS[k].toLowerCase()).join(", ")}.</p>}
      {error && <p className="rate-spot-error">{error}</p>}
      <div className="rate-spot-actions">
        <button type="button" className="btn-solid btn-compact" onClick={save} disabled={status === "saving" || missing.length > 0}>
          {status === "saving" ? "Saving..." : hasRated ? "Update rating" : "Submit rating"}
        </button>
        <button type="button" className="btn-ghost btn-compact" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
