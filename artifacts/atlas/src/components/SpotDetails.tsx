import { useEffect, useRef, useState } from "react";
import type { WorkSpot } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, isOpenNow, getTodayHoursLabel, SCORE_CATEGORY_LABELS } from "@/lib/types";
import { getGoogleMapsUrl, getAppleMapsUrl } from "@/lib/export";
import { BUSYNESS_LEVELS, getBusynessInfo, submitCrowdReport, timeAgo, type CrowdStatus } from "@/lib/crowd";
import CrowdMark from "./CrowdMark";
import Icon from "./Icon";
import RateSpot from "./RateSpot";
import ScoreDots from "./ScoreDots";
import TypicalBusyness from "./TypicalBusyness";
import SuggestEditModal from "./SuggestEditModal";
import ReportProblemModal from "./ReportProblemModal";

interface SpotDetailsProps {
  spot: WorkSpot;
  crowdStatus: CrowdStatus | null;
  // "back" when the details replace the list in the one card; "close" in the second sheet
  dismiss: "back" | "close";
  onDismiss: () => void;
  onRated: () => void;
  onCrowdReported: () => void;
  onNotice: (message: string) => void;
  // Only passed for admins; everyone else gets no delete control
  onDelete?: (id: string) => void;
}

// A spot's details: everything the map popup and the table's expanded row used to show, in one
// place. The order runs from what you came for (open now, how busy, how to get there) to what you
// rarely need (report a problem, delete).
export default function SpotDetails({ spot, crowdStatus, dismiss, onDismiss, onRated, onCrowdReported, onNotice, onDelete }: SpotDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [crowdPicker, setCrowdPicker] = useState<"closed" | "open" | "sending" | "sent">("closed");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const cat = CATEGORIES.find((c) => c.value === spot.category);
  const score = calcScore(spot.scores, spot.tags);
  const tags = getSpotDisplayTags(spot);
  const open = spot.operatingHours ? isOpenNow(spot.operatingHours) : null;
  const website = spot.website && /^https?:\/\//i.test(spot.website) ? spot.website : null;

  // A new spot starts the details from the top, with its own crowd picker closed
  useEffect(() => {
    setCrowdPicker("closed");
    setConfirmDelete(false);
    headingRef.current?.closest(".details-scroll")?.scrollTo({ top: 0 });
  }, [spot.id]);

  const reportCrowd = async (level: number) => {
    setCrowdPicker("sending");
    if (await submitCrowdReport(spot.id, level)) {
      setCrowdPicker("sent");
      onCrowdReported();
    } else {
      setCrowdPicker("open");
      onNotice("Couldn't send that crowd report. Try again in a moment.");
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(spot.address);
      onNotice("Address copied.");
    } catch {
      onNotice("Couldn't copy the address.");
    }
  };

  const crowd = crowdStatus ? getBusynessInfo(crowdStatus.level) : null;

  return (
    <article className="spot-details" aria-labelledby={`details-${spot.id}`}>
      <div className="details-top">
        {dismiss === "back" ? (
          <button type="button" className="btn-ghost" onClick={onDismiss}>
            <Icon name="arrow-left" weight="bold" size={16} />
            All spots
          </button>
        ) : (
          <button type="button" className="icon-button" aria-label="Close details" onClick={onDismiss}>
            <Icon name="x" weight="bold" size={16} />
          </button>
        )}
      </div>

      <header className="details-header">
        <h2 id={`details-${spot.id}`} ref={headingRef} className="details-name" tabIndex={-1}>
          {spot.name}
        </h2>
        <div className="details-sub">
          <span className="details-caps">
            {cat?.label ?? spot.category} · {spot.city}
          </span>
          <span className="details-score">{score.toFixed(1)}</span>
          {spot.ratingCount !== undefined && (
            <span className="details-meta">{spot.ratingCount === 1 ? "1 rating" : `${spot.ratingCount} ratings`}</span>
          )}
        </div>
        {spot.operatingHours && (
          <div className={`details-hours ${open ? "open" : "closed"}`}>
            <span className="hours-dot" aria-hidden="true" />
            <span className="details-hours-state">{open ? "Open" : "Closed"}</span>
            <span>{getTodayHoursLabel(spot.operatingHours)}</span>
          </div>
        )}
      </header>

      {(spot.aiSummary || spot.description) && (
        <p className={`details-summary${spot.aiSummary ? " is-summary" : ""}`}>{spot.aiSummary || spot.description}</p>
      )}

      {/* How busy it is now, and a picker to say so, opening in place */}
      <div className="details-crowd">
        {crowdPicker === "sent" ? (
          <span className="details-crowd-sent" role="status">Report sent. Thanks.</span>
        ) : crowdPicker === "closed" ? (
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
            <button type="button" className="btn-outline btn-compact" onClick={() => setCrowdPicker("open")}>
              <Icon name="users-three" weight="bold" size={16} />
              Report crowd level
            </button>
          </>
        ) : (
          <div className="details-crowd-picker" role="group" aria-label="How busy is it?">
            {/* Words only: the picker is a control, so it must not read as a colour legend */}
            {BUSYNESS_LEVELS.map((b) => (
              <button
                key={b.level}
                type="button"
                className="btn-outline btn-compact"
                disabled={crowdPicker === "sending"}
                onClick={() => reportCrowd(b.level)}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="details-actions">
        <a className="btn-outline" href={getGoogleMapsUrl(spot.lat, spot.lng, spot.name)} target="_blank" rel="noopener noreferrer">
          <Icon name="map-trifold" weight="bold" size={16} />
          Google Maps
        </a>
        <a className="btn-outline" href={getAppleMapsUrl(spot.lat, spot.lng, spot.name)} target="_blank" rel="noopener noreferrer">
          <Icon name="apple-logo" weight="bold" size={16} />
          Apple Maps
        </a>
      </div>

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
        </div>
      </section>

      <section className="details-section">
        <div className="details-section-head">
          <h3>Scores</h3>
          <span className="details-meta">from the community</span>
        </div>
        <div className="details-scores">
          {(Object.keys(spot.scores) as Array<keyof typeof spot.scores>).map((key) => (
            <div key={key} className="details-score-row">
              <span>{SCORE_CATEGORY_LABELS[key]}</span>
              <ScoreDots score={spot.scores[key]} className="score-dots" />
            </div>
          ))}
        </div>
        <TypicalBusyness spotId={spot.id} />
        <RateSpot spotId={spot.id} onRated={onRated} />
      </section>

      {tags.length > 0 && (
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
      )}

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
              <span>Delete this spot?</span>
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
    </article>
  );
}
