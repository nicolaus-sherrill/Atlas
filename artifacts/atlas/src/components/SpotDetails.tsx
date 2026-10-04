import { useEffect, useRef } from "react";
import type { WorkSpot } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import { getGoogleMapsUrl, getAppleMapsUrl } from "@/lib/export";
import type { CrowdStatus } from "@/lib/crowd";
import Icon from "./Icon";
import { SpotAbout, SpotCrowd, SpotFoot, SpotReviews, SpotScores, SpotSummary, SpotTags } from "./spot-sections";

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

// A spot's details in the map's panel or sheet, composed from the shared parts in spot-sections.
// The order runs from what you came for (open now, how busy, how to get there) to what you rarely
// need (report a problem, delete).
export default function SpotDetails({ spot, crowdStatus, dismiss, onDismiss, onRated, onCrowdReported, onNotice, onDelete }: SpotDetailsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  const cat = CATEGORIES.find((c) => c.value === spot.category);
  const score = calcScore(spot.scores, spot.tags);
  const open = spot.operatingHours ? isOpenNow(spot.operatingHours) : null;

  // A new spot starts the details from the top
  useEffect(() => {
    headingRef.current?.closest(".details-scroll")?.scrollTo({ top: 0 });
  }, [spot.id]);

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

      <SpotSummary spot={spot} />

      <SpotCrowd spot={spot} crowdStatus={crowdStatus} onCrowdReported={onCrowdReported} onNotice={onNotice} />

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

      <SpotAbout spot={spot} onNotice={onNotice} />
      <SpotScores spot={spot} onRated={onRated} />
      <SpotTags tags={getSpotDisplayTags(spot)} />
      <SpotReviews spot={spot} />
      <SpotFoot spot={spot} onNotice={onNotice} onDelete={onDelete} />
    </article>
  );
}
