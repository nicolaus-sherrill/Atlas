import { version } from "../../package.json";

const CHANGELOG = "https://github.com/nicolaus-sherrill/Atlas/blob/master/CHANGELOG.md";

// Who made Atlas, and which release this is. The version links to the changelog, so it reads as
// "what changed" rather than a build stamp.
export default function MadeBy() {
  return (
    <p className="made-by">
      Made by{" "}
      <a href="https://atmo.studio" target="_blank" rel="noreferrer">
        Atmo Studio
      </a>
      <span aria-hidden="true"> · </span>
      <a href={CHANGELOG} target="_blank" rel="noreferrer" aria-label={`Version ${version}, what changed`}>
        v{version}
      </a>
    </p>
  );
}
