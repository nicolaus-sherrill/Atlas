// A miniature of the busyness chart's bar: its colour and height follow the level
export default function CrowdMark({ level }: { level: number }) {
  return <span className={`crowd-mark level-${level}`} aria-hidden="true" />;
}
