// Details for a place a contributor picked: hours, website and tag suggestions, read from the
// place's OpenStreetMap tags. OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0.

import type { PlaceRef } from "./geocode";
import { categoryFromOsm } from "./geocode";
import { DAYS_OF_WEEK, type Category, type DayOfWeek, type OperatingHours, type TagId } from "./types";

export interface PlaceDetails {
  website?: string;
  operatingHours?: OperatingHours;
  // The original opening_hours text, shown when it can't be translated into Atlas's weekly format
  hoursText?: string;
  category?: Category;
  suggestedTags: TagId[];
}

export function osmUrl(place: PlaceRef): string {
  return `https://www.openstreetmap.org/${place.osmType}/${place.osmId}`;
}

const detailsCache = new Map<string, PlaceDetails>();

export async function fetchPlaceDetails(place: PlaceRef): Promise<PlaceDetails> {
  const key = `${place.osmType}/${place.osmId}`;
  const cached = detailsCache.get(key);
  if (cached) return cached;

  const res = await fetch(`https://api.openstreetmap.org/api/0.6/${key}.json`);
  if (!res.ok) return { suggestedTags: [] };
  const data: { elements?: { tags?: Record<string, string> }[] } = await res.json();
  const details = detailsFromTags(data.elements?.[0]?.tags ?? {});
  detailsCache.set(key, details);
  return details;
}

export function detailsFromTags(tags: Record<string, string>): PlaceDetails {
  const rawSite = tags.website || tags["contact:website"] || tags.url;
  const website = rawSite && /^https?:\/\//i.test(rawSite) ? rawSite : rawSite ? `https://${rawSite}` : undefined;

  const hoursText = tags.opening_hours;
  const operatingHours = hoursText ? parseOpeningHours(hoursText) ?? undefined : undefined;

  const category =
    categoryFromOsm("amenity", tags.amenity) ??
    categoryFromOsm("office", tags.office) ??
    categoryFromOsm("leisure", tags.leisure) ??
    categoryFromOsm("shop", tags.shop);

  const suggested = new Set<TagId>();
  if (tags.wheelchair === "yes") suggested.add("ada_accessible");
  if (tags.outdoor_seating === "yes") suggested.add("outdoor_seating");
  if (tags.amenity === "bar" || tags.amenity === "pub" || tags.bar === "yes" || tags["drink:beer"] === "yes" || tags["drink:wine"] === "yes") {
    suggested.add("alcohol");
  }
  if (tags.food === "yes" || tags.cuisine || tags.amenity === "restaurant") suggested.add("food");
  if (operatingHours && opensLate(operatingHours)) suggested.add("open_late");

  return { website, operatingHours, hoursText, category, suggestedTags: [...suggested] };
}

function opensLate(hours: OperatingHours): boolean {
  return DAYS_OF_WEEK.some((d) => {
    const h = hours[d];
    if (h.closed) return false;
    return h.close <= h.open || h.close > "21:00";
  });
}

// ---------- opening_hours ----------
// Handles the common forms: "Mo-Fr 07:00-19:00; Sa,Su 08:00-17:00", "Mo-Su 07:00-21:00", "24/7",
// "Su off", and split days like "Mo 08:00-12:00,13:00-17:00" (kept as first open to last close).
// Anything else (holidays, seasons, sunrise) returns null rather than a wrong guess.

const DAY_CODES: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };

function expandDays(spec: string): number[] | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const range = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!range) return null;
    const start = DAY_CODES[range[1]];
    const end = range[2] ? DAY_CODES[range[2]] : start;
    for (let i = start; ; i = (i + 1) % 7) {
      days.add(i);
      if (i === end) break;
    }
  }
  return [...days];
}

function normalizeTime(t: string): string | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 24 || Number(m[2]) > 59) return null;
  // Atlas stores midnight closing as 00:00, which its hours logic reads as "until midnight"
  return `${String(h % 24).padStart(2, "0")}:${m[2]}`;
}

export function parseOpeningHours(raw: string): OperatingHours | null {
  const text = raw.trim();
  const closedDay = { closed: true, open: "09:00", close: "17:00" };
  const result = Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, { ...closedDay }])) as OperatingHours;

  if (text === "24/7") {
    for (const d of DAYS_OF_WEEK) result[d] = { closed: false, open: "00:00", close: "00:00" };
    return result;
  }

  for (const rule of text.split(";").map((r) => r.trim()).filter(Boolean)) {
    // Public-holiday rules don't change the weekly schedule
    if (/^PH\b/.test(rule)) continue;

    const m = rule.match(/^([A-Za-z,\- ]+?)\s+(off|closed|[\d:,\- ]+)$/);
    if (!m) return null;
    const days = expandDays(m[1].replace(/\s+/g, ""));
    if (!days) return null;

    if (m[2] === "off" || m[2] === "closed") {
      for (const i of days) result[DAYS_OF_WEEK[i] as DayOfWeek] = { ...closedDay };
      continue;
    }

    const spans = m[2].split(",").map((s) => s.trim().split("-"));
    if (spans.some((s) => s.length !== 2)) return null;
    const open = normalizeTime(spans[0][0]);
    const close = normalizeTime(spans[spans.length - 1][1]);
    if (!open || !close) return null;
    for (const i of days) result[DAYS_OF_WEEK[i] as DayOfWeek] = { closed: false, open, close };
  }

  return result;
}
