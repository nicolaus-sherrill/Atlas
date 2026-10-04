import type { WorkSpot } from "@/lib/types";
import type { CrowdStatus } from "@/lib/crowd";
import Icon from "./Icon";
import { SpotAbout, SpotCrowd, SpotFoot, SpotReviews, SpotScores, SpotSummary, SpotTags } from "./spot-sections";

interface SpotRevealProps {
  spot: WorkSpot;
  allTags: string[];
  crowdStatus: CrowdStatus | null;
  onShowOnMap: () => void;
  onRated: () => void;
  onCrowdReported: () => void;
  onNotice: (message: string) => void;
  // Only passed for admins
  onDelete?: (id: string) => void;
}

// What opening a row in the list reveals, built from the same parts as the map's details panel
// (spot-sections), so a spot reads the same in either place. Two columns, kept narrow with room to
// spare on the right: the place (summary, crowd, About, the full tag list) and the scores, with
// rating it yourself as the main thing to do. Under both, full width, what people say, then the
// foot. Show on map is secondary there: the row's coordinates already do it.
export default function SpotReveal({ spot, allTags, crowdStatus, onShowOnMap, onRated, onCrowdReported, onNotice, onDelete }: SpotRevealProps) {
  return (
    <div className="reveal" onClick={(e) => e.stopPropagation()}>
      <div className="reveal-columns">
        <div className="reveal-main">
          <SpotSummary spot={spot} />
          <SpotCrowd spot={spot} crowdStatus={crowdStatus} onCrowdReported={onCrowdReported} onNotice={onNotice} />
          <SpotAbout spot={spot} onNotice={onNotice} />
          <SpotTags tags={allTags} />
        </div>
        <div className="reveal-side">
          <SpotScores spot={spot} onRated={onRated} />
        </div>
      </div>
      <SpotReviews spot={spot} />
      <SpotFoot
        spot={spot}
        onNotice={onNotice}
        onDelete={onDelete}
        lead={
          <button type="button" className="btn-outline btn-compact" onClick={onShowOnMap}>
            <Icon name="map-trifold" weight="bold" size={16} />
            Show on map
          </button>
        }
      />
    </div>
  );
}
