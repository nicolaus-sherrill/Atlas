// Atlas's type check: every font size and tracking value in src/ comes from one of Atlas's six type
// roles, which the design system lists in its Atlas tokens. The design system checks its own
// atlas.css the same way; this holds Atlas's CSS and the map popups' inline styles to it.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

const require = createRequire(import.meta.url);
const tokens = require('@atmo-studio/design-system/tokens/intent/atlas.light.tokens.json');
const ROLES = tokens.$extensions['studio.atmo'].typeRoles;
const SRC = new URL('../src/', import.meta.url).pathname;

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(css|tsx?)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

// Allowed values per property. Anything else is a hand-set size or tracking.
const role = `(${ROLES.join('|')})`;
const ALLOWED = {
  'font-size': new RegExp(`^(var\\(--type-${role}-font-size\\)|inherit|0)$`),
  'letter-spacing': new RegExp(`^(var\\(--type-${role}-letter-spacing\\)|var\\(--text-tracking-[a-z0-9-]+\\)|0|normal)$`),
  font: new RegExp(`^(var\\(--type-${role}\\)|inherit)$`),
};
// CSS declarations and inline style strings (font-size:12px), and React style objects (fontSize: 12)
const DECL = /(?<![\w-])(font-size|letter-spacing|font)\s*:\s*([^;"`}\n]+?)\s*(?:!important)?\s*(?=[;"`}\n])/g;
const JSX = /\b(fontSize|letterSpacing)\s*:\s*([^,}\n]+)/g;
const ANY_ROLE = /--type-([a-z0-9-]+?)(?:-(?:font-size|font-weight|line-height|letter-spacing|font-family|font-feature-settings))?\)/g;

const problems = [];
for (const file of files(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const at = `${relative(process.cwd(), file)}:${i + 1}`;
    for (const [, prop, value] of line.matchAll(DECL))
      if (!ALLOWED[prop].test(value.trim())) problems.push(`${at}  ${prop}: ${value.trim()}`);
    for (const [, prop, value] of line.matchAll(JSX)) problems.push(`${at}  ${prop}: ${value.trim()} (use a class)`);
    for (const [, r] of line.matchAll(ANY_ROLE))
      if (!ROLES.includes(r)) problems.push(`${at}  --type-${r} is outside Atlas's six roles`);
  });
}

if (problems.length) {
  console.error(`Type outside Atlas's six roles (${ROLES.join(', ')}):\n${problems.join('\n')}\n${problems.length} found`);
  process.exit(1);
}
console.log(`Type check: every size and tracking value uses Atlas's six roles (${ROLES.join(', ')}).`);
