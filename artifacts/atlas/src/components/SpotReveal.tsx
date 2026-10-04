import type { WorkSpot } from "@/lib/types";
import { formatWeeklyHours } from "@/lib/types";
import { SCORE_CATEGORY_LABELS } from "@/lib/types";
import Icon from "./Icon";
import RateSpot from "./RateSpot";
import ScoreDots from "./ScoreDots";
import TypicalBusyness from "./TypicalBusyness";

interface SpotRevealProps {
  spot: WorkSpot;
  // All the spot's tags, and the ones the row couldn't fit. Where the row shows its tags column the
  // reveal lists only the rest; where that column has dropped out, it lists them all
  allTags: string[];
  hiddenTags: string[];
  confirmingDelete: boolean;
  onShowOnMap: () => void;
  onEdit: () => void;
  onReport: () => void;
  onRated: () => void;
  // Only passed for admins
  onDeleteAsk?: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}

// What opening a row in the list reveals. The row already shows the name, city, type, today's
// hours, three tags and the score, so none of those come back here. The reveal adds what the row
// can't hold: what the place is like, where it is and when it's open all week, how it scores in
// each category, and what you can do next, in that order of weight.
export default function SpotReveal({
  spot,
  allTags,
  hiddenTags,
  confirmingDelete,
  onShowOnMap,
  onEdit,
  onReport,
  onRated,
  onDeleteAsk,
  onDeleteCancel,
  onDeleteConfirm,
}: SpotRevealProps) {
  const summary = spot.aiSummary || spot.description;
  // The note from whoever added it, when the summary is the AI's and the note says something else
  const note = spot.aiSummary && spot.description && spot.description !== spot.aiSummary ? spot.description : null;
  const website = spot.website && /^https?:\/\//i.test(spot.website) ? spot.website : null;

  return (
    <div className="reveal" onClick={(e) => e.stopPropagation()}>
      <section className="reveal-about" aria-label="About">
        {summary && <p className={`reveal-summary${spot.aiSummary ? " is-summary" : ""}`}>{summary}</p>}
        {note && <p className="reveal-note">“{note}”</p>}
        <dl className="reveal-facts">
          <div>
            <dt>Address</dt>
            <dd>{spot.address}</dd>
          </div>
          {website && (
            <div>
              <dt>Website</dt>
              <dd>
                <a className="reveal-link" href={website} target="_blank" rel="noopener noreferrer">
                  {website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </dd>
            </div>
          )}
          {spot.operatingHours && (
            <div>
              <dt>Hours</dt>
              <dd>
                {formatWeeklyHours(spot.operatingHours).map((line) => (
                  <span key={line} className="reveal-hours-line">{line}</span>
                ))}
              </dd>
            </div>
          )}
          {hiddenTags.length > 0 && (
            <div className="reveal-tags-rest">
              <dt>Also</dt>
              <dd>{hiddenTags.join(", ")}</dd>
            </div>
          )}
          {allTags.length > 0 && (
            <div className="reveal-tags-all">
              <dt>Tags</dt>
              <dd>{allTags.join(", ")}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="reveal-scores" aria-label="Scores">
        <h4 className="reveal-heading">
          Scores
          {spot.ratingCount !== undefined && (
            <span>from {spot.ratingCount === 1 ? "1 rating" : `${spot.ratingCount} ratings`}</span>
          )}
        </h4>
        <div className="reveal-score-rows">
          {(Object.keys(spot.scores) as Array<keyof typeof spot.scores>).map((key) => (
            <div key={key} className="reveal-score-row">
              <span>{SCORE_CATEGORY_LABELS[key]}</span>
              <ScoreDots score={spot.scores[key]} className="score-dots" />
            </div>
          ))}
        </div>
        <RateSpot spotId={spot.id} onRated={onRated} />
        <TypicalBusyness spotId={spot.id} />
      </section>

      <section className="reveal-actions" aria-label="Actions">
        <button type="button" className="btn-solid" onClick={onShowOnMap}>
          Show on map
          <Icon name="arrow-right" weight="bold" size={16} />
        </button>
        <button type="button" className="details-link" onClick={onEdit}>
          <Icon name="pencil-simple" weight="bold" size={16} />
          Suggest an edit
        </button>
        <button type="button" className="details-link reveal-quiet" onClick={onReport}>
          <Icon name="flag" weight="bold" size={16} />
          Report a problem
        </button>
        {onDeleteAsk &&
          (confirmingDelete ? (
            <div className="reveal-delete">
              <span>Delete this spot?</span>
              <button type="button" className="btn-danger btn-compact" onClick={onDeleteConfirm}>
                Yes, delete
              </button>
              <button type="button" className="btn-ghost btn-compact" onClick={onDeleteCancel}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="details-link details-link-danger" onClick={onDeleteAsk}>
              <Icon name="trash" weight="bold" size={16} />
              Delete spot
            </button>
          ))}
      </section>
    </div>
  );
}
