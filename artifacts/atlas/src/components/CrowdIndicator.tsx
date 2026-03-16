import type { CrowdStatus } from "@/lib/crowd";
import { getBusynessInfo, timeAgo } from "@/lib/crowd";

interface CrowdIndicatorProps {
  status: CrowdStatus | null;
  compact?: boolean;
}

export default function CrowdIndicator({ status, compact }: CrowdIndicatorProps) {
  if (!status) {
    if (compact) return <span className="crowd-indicator-compact no-data">--</span>;
    return null;
  }

  const info = getBusynessInfo(status.level);

  if (compact) {
    return (
      <span className="crowd-indicator-compact" title={`${info.label} - ${timeAgo(status.lastReportedAt)}`}>
        <span className="crowd-dot" style={{ background: info.color }} />
        <span className="crowd-compact-label">{info.label}</span>
      </span>
    );
  }

  return (
    <div className="crowd-indicator">
      <span className="crowd-dot" style={{ background: info.color }} />
      <span className="crowd-label">{info.label}</span>
      <span className="crowd-time">{timeAgo(status.lastReportedAt)}</span>
    </div>
  );
}
