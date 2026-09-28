import type { PlaceLink } from "@/hooks/use-place-link";
import { osmUrl } from "@/lib/osm";
import { formatWeeklyHours } from "@/lib/types";

interface PlaceLinkCardProps {
  link: PlaceLink;
  onClear: () => void;
}

// Shows what Atlas found for the place a contributor picked, and lets them unlink it.
export default function PlaceLinkCard({ link, onClear }: PlaceLinkCardProps) {
  const { details } = link;
  const hours = details?.operatingHours ? formatWeeklyHours(details.operatingHours) : null;
  const website = details?.website;

  return (
    <div className="place-link-card" aria-live="polite">
      <div className="place-link-card-header">
        <span className="place-link-card-title">
          Matched to{" "}
          <a href={osmUrl(link.place)} target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
        </span>
        <button type="button" className="place-link-card-clear" onClick={onClear}>
          Not this place
        </button>
      </div>

      {link.loading ? (
        <div className="place-link-card-note">Looking up hours and website...</div>
      ) : (
        <>
          <dl>
            <dt>Hours</dt>
            <dd>{hours ? hours.join(", ") : details?.hoursText ?? "Not listed"}</dd>
            <dt>Website</dt>
            <dd>
              {website ? (
                <a href={website} target="_blank" rel="noreferrer">
                  {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              ) : (
                "Not listed"
              )}
            </dd>
          </dl>
          {details && details.suggestedTags.length > 0 && (
            <div className="place-link-card-note">Tags pre-selected below from OpenStreetMap. Check they're right.</div>
          )}
        </>
      )}
    </div>
  );
}
