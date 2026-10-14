// The parts a spot's details are built from. The map's details panel (SpotDetails) and the list's
// open row (SpotReveal) both compose these, so a spot reads the same wherever you open it; only
// the arrangement differs. Each part owns its own state and modals.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { WorkSpot } from "@/lib/types";
import { deleteMyReview, fetchReviews, REVIEW_MAX_LENGTH, submitReview, type Review } from "@/lib/reviews";
import { calcScore, formatWeeklyHours, SCORE_CATEGORY_LABELS } from "@/lib/types";
import { BUSYNESS_LEVELS, getBusynessInfo, submitCrowdReport, timeAgo, type CrowdStatus } from "@/lib/crowd";
import CrowdMark from "./CrowdMark";
import Icon from "./Icon";
import RateSpot from "./RateSpot";
import ScoreDots from "./ScoreDots";
import TypicalBusyness from "./TypicalBusyness";
import SuggestEditModal from "./SuggestEditModal";
import ReportProblemModal from "./ReportProblemModal";

// ---------- What the place is like: the summary, and what people say ----------

// People's notes about a spot, shown as reviews: the note from whoever added the spot first, then
// everyone's reviews, newest first. The row scrolls sideways to hold them.
function reviewsOf(spot: WorkSpot, reviews: Review[]) {
  const added = spot.description
    ? [{ key: "added", text: spot.description, by: "From the person who added it", date: spot.submittedAt }]
    : [];
  return [
    ...added,
    ...reviews.map((r) => ({ key: r.id, text: r.body, by: r.mine ? "Your review" : "From someone on Atlas", date: r.created_at })),
  ];
}

// The AI summary, written from people's notes
export function SpotSummary({ spot }: { spot: WorkSpot }) {
  if (!spot.aiSummary) return null;
  return <p className="details-summary">{spot.aiSummary}</p>;
}

// People's notes as outlined review cards, in one row that scrolls sideways when they overflow, and
// a way to add your own. They sit low in the details, after the facts and the scores
export function SpotReviews({ spot }: { spot: WorkSpot }) {
  const [list, setList] = useState<Review[]>([]);
  const load = useCallback(() => {
    let cancelled = false;
    fetchReviews(spot.id)
      .then((r) => !cancelled && setList(r))
      .catch(() => !cancelled && setList([]));
    return () => {
      cancelled = true;
    };
  }, [spot.id]);
  useEffect(load, [load]);

  const reviews = reviewsOf(spot, list);
  const mine = list.find((r) => r.mine) ?? null;
  return (
    <section className="details-section">
      <div className="details-section-head">
        <h3>What people say</h3>
      </div>
      {reviews.length > 0 && (
        <div className="review-scroller" role="list" aria-label="What people say" tabIndex={0}>
          {reviews.map((r) => (
            <figure key={r.key} className="review-card" role="listitem">
              <blockquote>{r.text}</blockquote>
              <figcaption>
                {r.by}
                {r.date && <> · {new Date(r.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <WriteReview spotId={spot.id} mine={mine} onSaved={load} />
    </section>
  );
}

// Lets anyone write one review of a spot, or change or delete the one they wrote
function WriteReview({ spotId, mine, onSaved }: { spotId: string; mine: Review | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "deleted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setOpen(false);
    setStatus("idle");
  }, [spotId]);

  const begin = () => {
    setBody(mine?.body ?? "");
    setError(null);
    setStatus("idle");
    setOpen(true);
  };

  const run = async (action: () => Promise<void>, done: "saved" | "deleted") => {
    setStatus("saving");
    setError(null);
    try {
      await action();
      setStatus(done);
      setOpen(false);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("Too many") ? "You've written a lot of reviews this hour. Try again later." : "Couldn't save your review. Try again.");
      setStatus("error");
    }
  };

  if (!open) {
    return (
      <div className="rate-spot write-review">
        <button type="button" className="btn-ghost btn-compact" onClick={(e) => { e.stopPropagation(); begin(); }}>
          {mine ? "Edit your review" : "Write a review"}
        </button>
        {status === "saved" && <span className="rate-spot-note">Thanks. Your review is up.</span>}
        {status === "deleted" && <span className="rate-spot-note">Your review is deleted.</span>}
      </div>
    );
  }

  const id = `review-${spotId}`;
  return (
    <div className="rate-spot rate-spot-open write-review" onClick={(e) => e.stopPropagation()}>
      <div className="form-group">
        <label htmlFor={id}>Your review</label>
        <textarea
          id={id}
          rows={4}
          maxLength={REVIEW_MAX_LENGTH}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's it like to work here?"
        />
      </div>
      {error && <p className="rate-spot-error">{error}</p>}
      <div className="rate-spot-actions">
        <button
          type="button"
          className="btn-solid btn-compact"
          onClick={() => run(() => submitReview(spotId, body), "saved")}
          disabled={status === "saving" || !body.trim()}
        >
          {status === "saving" ? "Saving..." : mine ? "Update review" : "Post review"}
        </button>
        <button type="button" className="btn-ghost btn-compact" onClick={() => setOpen(false)}>
          Cancel
        </button>
        {mine && (
          <button
            type="button"
            className="btn-ghost btn-compact"
            onClick={() => run(() => deleteMyReview(spotId), "deleted")}
            disabled={status === "saving"}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- How busy it is now, with a picker to say so ----------

interface SpotCrowdProps {
  spot: WorkSpot;
  crowdStatus: CrowdStatus | null;
  onCrowdReported: () => void;
  onNotice: (message: string) => void;
}

export function SpotCrowd({ spot, crowdStatus, onCrowdReported, onNotice }: SpotCrowdProps) {
  const [picker, setPicker] = useState<"closed" | "open" | "sending" | "sent">("closed");
  useEffect(() => setPicker("closed"), [spot.id]);

  const report = async (level: number) => {
    setPicker("sending");
    if (await submitCrowdReport(spot.id, level)) {
      setPicker("sent");
      onCrowdReported();
    } else {
      setPicker("open");
      onNotice("Couldn't send that crowd report. Try again in a moment.");
    }
  };

  const crowd = crowdStatus ? getBusynessInfo(crowdStatus.level) : null;
  return (
    <div className="details-crowd">
      {picker === "sent" ? (
        <span className="details-crowd-sent" role="status">Report sent. Thanks.</span>
      ) : picker === "closed" ? (
        <>
          {crowd && crowdStatus ? (
            <span className="details-crowd-now">
              <CrowdMark level={crowd.level} />
              <span className="details-crowd-label">{crowd.label}</span>
              <span className="details-meta">{timeAgo(crowdStatus.lastReportedAt)}</span>
            </span>
          ) : (
            <span className="details-meta">No crowd reports today</span>
          )}
          <button type="button" className="btn-outline btn-compact" onClick={() => setPicker("open")}>
            <Icon name="users-three" weight="bold" size={16} />
            Report crowd level
          </button>
        </>
      ) : (
        <div className="details-crowd-picker" role="group" aria-label="How busy is it?">
          {/* Words only: the picker is a control, so it must not read as a colour legend */}
          {BUSYNESS_LEVELS.map((b) => (
            <button key={b.level} type="button" className="btn-outline btn-compact" disabled={picker === "sending"} onClick={() => report(b.level)}>
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- About: the facts, in an outlined group, with Suggest an edit beside the heading ----------

export function SpotAbout({ spot, onNotice }: { spot: WorkSpot; onNotice: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const website = spot.website && /^https?:\/\//i.test(spot.website) ? spot.website : null;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(spot.address);
      onNotice("Address copied.");
    } catch {
      onNotice("Couldn't copy the address.");
    }
  };

  return (
    <section className="details-section">
      <div className="details-section-head">
        <h3>About</h3>
        {/* It edits exactly the facts in this group */}
        <button type="button" className="details-link" onClick={() => setEditing(true)}>
          <Icon name="pencil-simple" weight="bold" size={16} />
          Suggest an edit
        </button>
      </div>
      <div className="details-group">
        <div className="details-group-row">
          <Icon name="map-pin" weight="bold" size={16} />
          <span>{spot.address}</span>
          <button type="button" className="icon-button icon-button-small" aria-label="Copy address" onClick={copyAddress}>
            <Icon name="copy" weight="bold" size={16} />
          </button>
        </div>
        {website && (
          <a className="details-group-row" href={website} target="_blank" rel="noopener noreferrer">
            <Icon name="globe" weight="bold" size={16} />
            <span className="details-group-link">{website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}</span>
            <span aria-hidden="true">↗</span>
          </a>
        )}
        {spot.operatingHours && (
          <div className="details-group-row details-group-row-top">
            <Icon name="clock" weight="bold" size={16} />
            <span className="details-week">
              {formatWeeklyHours(spot.operatingHours).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </div>
        )}
      </div>
      {editing && (
        <SuggestEditModal
          spot={spot}
          onClose={() => setEditing(false)}
          onSent={() => {
            setEditing(false);
            onNotice("Thanks. Your edit is waiting for review.");
          }}
        />
      )}
    </section>
  );
}

// ---------- Scores: the overall score, each category under it, then rating it yourself ----------

export function SpotScores({ spot, onRated }: { spot: WorkSpot; onRated: () => void }) {
  return (
    <section className="details-section">
      <div className="details-section-head">
        <h3>Scores</h3>
      </div>
      <div className="details-overall">
        <span className="details-overall-score">{calcScore(spot.scores, spot.tags).toFixed(1)}</span>
        <span className="details-overall-label">
          Overall
          <span className="details-meta">
            {!spot.ratingCount ? "No ratings yet" : `from ${spot.ratingCount === 1 ? "1 rating" : `${spot.ratingCount} ratings`}`}
          </span>
        </span>
      </div>
      <div className="details-scores">
        {(Object.keys(spot.scores) as Array<keyof typeof spot.scores>).map((key) => (
          <div key={key} className="details-score-row">
            <span>{SCORE_CATEGORY_LABELS[key]}</span>
            <ScoreDots score={spot.scores[key]} className="score-dots" />
          </div>
        ))}
      </div>
      <RateSpot spotId={spot.id} onRated={onRated} />
      <TypicalBusyness spotId={spot.id} />
    </section>
  );
}

// ---------- Tags: the full list ----------

export function SpotTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <section className="details-section">
      <div className="details-section-head">
        <h3>Tags</h3>
      </div>
      <div className="details-tags">
        {tags.map((t) => (
          <span key={t} className="details-tag">{t}</span>
        ))}
      </div>
    </section>
  );
}

// ---------- The foot: Report a problem, and the admin delete, last ----------

interface SpotFootProps {
  spot: WorkSpot;
  onNotice: (message: string) => void;
  // Only passed for admins
  onDelete?: (id: string) => void;
  // Anything that leads the row, such as the list's Show on map
  lead?: ReactNode;
}

export function SpotFoot({ spot, onNotice, onDelete, lead }: SpotFootProps) {
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [spot.id]);

  return (
    <div className="details-foot">
      {lead}
      {/* Rarer, about the spot rather than a field, and kept out of thumb reach at the foot */}
      <div className="details-report">
        <Icon name="flag" weight="bold" size={16} />
        <button type="button" className="details-link" onClick={() => setReporting(true)}>
          Report a problem
        </button>
        <span className="details-hint">Closed for good, unsafe, or not a work spot</span>
      </div>
      {onDelete && (
        <div className="details-delete">
          {confirmDelete ? (
            <>
              <span>Delete this spot? It can be restored from admin for 90 days.</span>
              <button type="button" className="btn-danger btn-compact" onClick={() => onDelete(spot.id)}>
                Yes, delete
              </button>
              <button type="button" className="btn-outline btn-compact" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="details-link details-link-danger" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" weight="bold" size={16} />
              Delete spot
            </button>
          )}
        </div>
      )}
      {reporting && (
        <ReportProblemModal
          spot={spot}
          onClose={() => setReporting(false)}
          onSent={() => {
            setReporting(false);
            onNotice("Thanks. We'll look into it.");
          }}
        />
      )}
    </div>
  );
}
