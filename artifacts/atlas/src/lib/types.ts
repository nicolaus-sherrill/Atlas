import type { IconName } from "./icon-names";

// Atlas maps public third spaces: anywhere anyone can walk into without a membership or an
// invitation, where staying an hour or more is normal.

export type Category =
  | "cafe" | "bar" | "food_hall"
  | "library" | "community_center"
  | "museum" | "bookstore" | "makerspace"
  | "park"
  | "coworking" | "hotel";

// A family groups categories. It only sets the pin colour; the filters list the categories themselves.
export type Family = "food_drink" | "civic" | "culture" | "outdoors" | "work_stay";

export const FAMILIES: { value: Family; label: string }[] = [
  { value: "food_drink", label: "Food & drink" },
  { value: "civic", label: "Civic" },
  { value: "culture", label: "Culture" },
  { value: "outdoors", label: "Outdoors" },
  { value: "work_stay", label: "Work & stay" },
];

// Every category has a one-word label, and a spot has exactly one category.
export const CATEGORIES: { value: Category; label: string; icon: IconName; family: Family }[] = [
  { value: "cafe", label: "Cafe", icon: "coffee", family: "food_drink" },
  { value: "bar", label: "Bar", icon: "wine", family: "food_drink" },
  { value: "food_hall", label: "Market", icon: "fork-knife", family: "food_drink" },
  { value: "library", label: "Library", icon: "books", family: "civic" },
  { value: "community_center", label: "Community", icon: "users", family: "civic" },
  { value: "museum", label: "Museum", icon: "bank", family: "culture" },
  { value: "bookstore", label: "Bookstore", icon: "book-open", family: "culture" },
  { value: "makerspace", label: "Makerspace", icon: "hammer", family: "culture" },
  { value: "park", label: "Park", icon: "tree", family: "outdoors" },
  { value: "coworking", label: "Coworking", icon: "briefcase", family: "work_stay" },
  { value: "hotel", label: "Hotel", icon: "bed", family: "work_stay" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<Category, (typeof CATEGORIES)[number]>;

export function categoryDef(category: Category) {
  return CATEGORY_MAP[category] ?? CATEGORIES[0];
}

// What a place is good for. Every spot has at least one.
export type GoodFor = "work" | "gather" | "create";

export const GOOD_FOR: { value: GoodFor; label: string; hint: string }[] = [
  { value: "work", label: "Working", hint: "Suits a remote-work session: a laptop, a few hours" },
  { value: "gather", label: "Gathering", hint: "Public, cultural places, like museums and parks, to exist in public" },
  { value: "create", label: "Creating", hint: "Work that isn't remote or laptop work: making, craft, art, tools" },
];

export const GOOD_FOR_LABELS = Object.fromEntries(GOOD_FOR.map((g) => [g.value, g.label])) as Record<GoodFor, string>;

// The criteria a visitor rates, 1 to 5. Hours is scored too, from the spot's opening hours.
export type RatedCriterion = "seating" | "wifi" | "outlets" | "food" | "atmosphere" | "access";
export type ScoreCategory = RatedCriterion | "hours";

// A criterion nobody has rated is absent, never a low number
export type CategoryScores = Partial<Record<RatedCriterion, number>>;

export const EMPTY_SCORES: CategoryScores = {};

export interface ScoreCategoryDef {
  key: ScoreCategory;
  label: string;
  baseWeight: number;
}

export const SCORE_CATEGORIES: ScoreCategoryDef[] = [
  { key: "seating", label: "Seating & comfort", baseWeight: 0.25 },
  { key: "wifi", label: "WiFi", baseWeight: 0.20 },
  { key: "outlets", label: "Outlets", baseWeight: 0.15 },
  { key: "access", label: "Accessibility", baseWeight: 0.15 },
  { key: "atmosphere", label: "Atmosphere", baseWeight: 0.10 },
  { key: "hours", label: "Hours", baseWeight: 0.10 },
  { key: "food", label: "Food & drink", baseWeight: 0.05 },
];

export const RATED_CRITERIA = SCORE_CATEGORIES.filter((sc) => sc.key !== "hours") as (ScoreCategoryDef & { key: RatedCriterion })[];

export const SCORE_CATEGORY_LABELS = Object.fromEntries(SCORE_CATEGORIES.map((sc) => [sc.key, sc.label])) as Record<ScoreCategory, string>;

// What a rating must cover follows from what the place is. Seating, atmosphere and access are
// expected everywhere. Food and drink is expected only at food and drink places. Wifi and outlets
// are expected only where the spot is good for work, and never outdoors. Anything else is
// optional: left blank it doesn't count against the place, and rated it counts for it.
// The database enforces the same rule (private.enforce_score_rules).
export type RatedPlace = { category: Category; goodFor: GoodFor[] };

export function isOptionalCriterion(place: RatedPlace, key: RatedCriterion): boolean {
  const family = categoryDef(place.category).family;
  if (key === "food") return family !== "food_drink";
  if (key === "wifi" || key === "outlets") return family === "outdoors" || !place.goodFor.includes("work");
  return false;
}

export function missingCriteria(place: RatedPlace, scores: CategoryScores): RatedCriterion[] {
  return RATED_CRITERIA.map((sc) => sc.key).filter((k) => scores[k] == null && !isOptionalCriterion(place, k));
}

export type TagId =
  | "natural_lighting" | "open_late" | "quiet" | "food" | "alcohol"
  | "ada_accessible" | "bike_racks" | "transit_nearby" | "outdoor_seating"
  | "free_parking" | "laptop_friendly" | "wifi_portal" | "no_wifi_password"
  | "generous_seating" | "restrooms" | "drinking_water" | "shade"
  | "dog_friendly" | "kid_friendly";

export type TagGroup = "space" | "amenities" | "access";

export const TAG_GROUPS: { key: TagGroup; label: string }[] = [
  { key: "space", label: "The space" },
  { key: "amenities", label: "Amenities" },
  { key: "access", label: "Getting there" },
];

export interface TagDefinition {
  id: TagId;
  label: string;
  group: TagGroup;
}

// Tags are plain facts about a place. They don't change its score.
export const TAGS: TagDefinition[] = [
  { id: "natural_lighting", label: "Natural Lighting", group: "space" },
  { id: "quiet", label: "Quiet", group: "space" },
  { id: "generous_seating", label: "Generous Seating", group: "space" },
  { id: "outdoor_seating", label: "Outdoor Seating", group: "space" },
  { id: "shade", label: "Shade or Cover", group: "space" },
  { id: "laptop_friendly", label: "Laptop-Friendly", group: "space" },
  { id: "dog_friendly", label: "Dog-Friendly", group: "space" },
  { id: "kid_friendly", label: "Kid-Friendly", group: "space" },
  { id: "open_late", label: "Open Late", group: "space" },
  { id: "wifi_portal", label: "WiFi Network Portal", group: "amenities" },
  { id: "no_wifi_password", label: "No WiFi Password", group: "amenities" },
  { id: "restrooms", label: "Public Restrooms", group: "amenities" },
  { id: "drinking_water", label: "Drinking Water", group: "amenities" },
  { id: "food", label: "Food", group: "amenities" },
  { id: "alcohol", label: "Alcohol", group: "amenities" },
  { id: "ada_accessible", label: "ADA Accessible", group: "access" },
  { id: "transit_nearby", label: "Transit Stop Nearby", group: "access" },
  { id: "bike_racks", label: "Bike Racks Available", group: "access" },
  { id: "free_parking", label: "Free Parking Nearby", group: "access" },
];

const TAG_LABEL_MAP: Record<string, string> = {};
TAGS.forEach((tag) => {
  TAG_LABEL_MAP[tag.id] = tag.label;
});

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const DAY_LABELS_FULL: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

export type OperatingHours = Record<DayOfWeek, DayHours>;

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { closed: false, open: "08:00", close: "18:00" },
  tuesday: { closed: false, open: "08:00", close: "18:00" },
  wednesday: { closed: false, open: "08:00", close: "18:00" },
  thursday: { closed: false, open: "08:00", close: "18:00" },
  friday: { closed: false, open: "08:00", close: "18:00" },
  saturday: { closed: true, open: "08:00", close: "18:00" },
  sunday: { closed: true, open: "08:00", close: "18:00" },
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function getCurrentDay(): DayOfWeek {
  const jsDay = new Date().getDay();
  const map: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[jsDay];
}

function getPreviousDay(day: DayOfWeek): DayOfWeek {
  const idx = DAYS_OF_WEEK.indexOf(day);
  return DAYS_OF_WEEK[(idx + 6) % 7];
}

function isOvernightSchedule(openMin: number, closeMin: number): boolean {
  return closeMin <= openMin;
}

export function isOpenNow(hours: OperatingHours): boolean {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const day = getCurrentDay();
  const dh = hours[day];

  if (!dh.closed) {
    const openMin = timeToMinutes(dh.open);
    const closeMin = timeToMinutes(dh.close);
    if (isOvernightSchedule(openMin, closeMin)) {
      if (nowMin >= openMin) return true;
    } else {
      if (nowMin >= openMin && nowMin < closeMin) return true;
    }
  }

  const prevDay = getPreviousDay(day);
  const prevDh = hours[prevDay];
  if (!prevDh.closed) {
    const prevOpenMin = timeToMinutes(prevDh.open);
    const prevCloseMin = timeToMinutes(prevDh.close);
    if (isOvernightSchedule(prevOpenMin, prevCloseMin) && prevCloseMin > 0) {
      if (nowMin < prevCloseMin) return true;
    }
  }

  return false;
}

export function getTodayHoursLabel(hours: OperatingHours): string {
  const day = getCurrentDay();
  const dh = hours[day];
  if (dh.closed) return "Closed today";
  return `${formatTime12h(dh.open)}–${formatTime12h(dh.close)}`;
}

// Where a place stands right now, as Google Maps says it: "Open" with when it closes, or "Closed"
// with when it next opens. Null when the week holds no open hours at all.
export function hoursStatus(hours: OperatingHours): { open: boolean; detail: string } | null {
  const open = isOpenNow(hours);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = getCurrentDay();
  if (open) {
    const dh = hours[today];
    const openMin = timeToMinutes(dh.open);
    const closeMin = timeToMinutes(dh.close);
    const inToday = !dh.closed && (isOvernightSchedule(openMin, closeMin) ? nowMin >= openMin : nowMin >= openMin && nowMin < closeMin);
    // Otherwise it's still inside last night's overnight hours
    return { open: true, detail: `Closes ${formatTime12h(inToday ? dh.close : hours[getPreviousDay(today)].close)}` };
  }
  const todayHours = hours[today];
  if (!todayHours.closed && nowMin < timeToMinutes(todayHours.open)) return { open: false, detail: `Opens ${formatTime12h(todayHours.open)}` };
  for (let i = 1; i <= 7; i++) {
    const day = DAYS_OF_WEEK[(DAYS_OF_WEEK.indexOf(today) + i) % 7];
    if (!hours[day].closed) return { open: false, detail: `Opens ${i === 1 ? "tomorrow " : `${DAY_LABELS[day]} `}${formatTime12h(hours[day].open)}` };
  }
  return null;
}

// One row per day, Monday first, for the full week
export function weekHoursRows(hours: OperatingHours): { day: DayOfWeek; label: string; range: string; today: boolean }[] {
  const today = getCurrentDay();
  return DAYS_OF_WEEK.map((day) => {
    const dh = hours[day];
    return { day, label: DAY_LABELS_FULL[day], range: dh.closed ? "Closed" : `${formatTime12h(dh.open)} – ${formatTime12h(dh.close)}`, today: day === today };
  });
}

export function formatWeeklyHours(hours: OperatingHours): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < DAYS_OF_WEEK.length) {
    const startDay = DAYS_OF_WEEK[i];
    const dh = hours[startDay];
    let j = i + 1;
    while (j < DAYS_OF_WEEK.length) {
      const nextDh = hours[DAYS_OF_WEEK[j]];
      if (nextDh.closed !== dh.closed || (!dh.closed && (nextDh.open !== dh.open || nextDh.close !== dh.close))) break;
      j++;
    }
    const endDay = DAYS_OF_WEEK[j - 1];
    const dayRange = startDay === endDay ? DAY_LABELS[startDay] : `${DAY_LABELS[startDay]}–${DAY_LABELS[endDay]}`;
    const timeRange = dh.closed ? "Closed" : `${formatTime12h(dh.open)}–${formatTime12h(dh.close)}`;
    lines.push(`${dayRange}: ${timeRange}`);
    i = j;
  }
  return lines;
}

export interface WorkSpot {
  id: string;
  name: string;
  category: Category;
  // What the place is good for; never empty
  goodFor: GoodFor[];
  // True where getting in costs money: a ticket, a day pass
  paidEntry: boolean;
  city: string;
  address: string;
  lat: number;
  lng: number;
  scores: CategoryScores;
  tags: TagId[];
  description: string;
  aiSummary?: string;
  operatingHours?: OperatingHours;
  website?: string;
  // The real place this spot was matched to on OpenStreetMap, if any
  osmType?: "node" | "way" | "relation";
  osmId?: number;
  // How many people's ratings the scores average
  ratingCount?: number;
  submittedAt: string;
}

// Weekly opening hours as a 1 to 5 score: the more of the week a place is open, the more
// schedules it fits. 16 hours a day or more earns a 5; under 35 hours a week earns a 1.
export function hoursScore(hours?: OperatingHours): number | undefined {
  if (!hours) return undefined;
  let weekly = 0;
  for (const d of DAYS_OF_WEEK) {
    const h = hours[d];
    if (!h || h.closed) continue;
    const open = timeToMinutes(h.open);
    const close = timeToMinutes(h.close);
    weekly += (close <= open ? close + 1440 - open : close - open) / 60;
  }
  if (weekly >= 112) return 5;
  if (weekly >= 84) return 4;
  if (weekly >= 56) return 3;
  if (weekly >= 35) return 2;
  return 1;
}

// The overall score: a weighted average of every criterion that has a number. A criterion with
// no number (unrated wifi in a park, hours nobody has entered) is left out and the rest scale up.
export function calcScore(scores: CategoryScores, hours?: OperatingHours): number {
  const values: Partial<Record<ScoreCategory, number>> = { ...scores, hours: hoursScore(hours) };
  let total = 0;
  let weight = 0;
  for (const sc of SCORE_CATEGORIES) {
    const v = values[sc.key];
    if (v == null) continue;
    total += sc.baseWeight * v;
    weight += sc.baseWeight;
  }
  return weight === 0 ? 0 : Math.round((total / weight) * 10) / 10;
}

export function spotScore(spot: Pick<WorkSpot, "scores" | "operatingHours">): number {
  return calcScore(spot.scores, spot.operatingHours);
}

// Each rated criterion's number for a spot, in display order. Unrated ones are absent. Hours is
// left out on purpose: it counts toward the overall score but is shown as opening hours, not a rating.
export function spotScoreRows(spot: Pick<WorkSpot, "scores">): { key: RatedCriterion; label: string; value: number }[] {
  return RATED_CRITERIA.filter((sc) => spot.scores[sc.key] != null).map((sc) => ({ key: sc.key, label: sc.label, value: spot.scores[sc.key]! }));
}

export function getTagLabel(tagId: string): string {
  return TAG_LABEL_MAP[tagId] || tagId;
}

const TAG_ORDER: Record<string, number> = Object.fromEntries(TAGS.map((t, i) => [t.id, i]));

export function getSpotDisplayTags(spot: Pick<WorkSpot, "tags">): string[] {
  return [...spot.tags]
    .sort((a, b) => (TAG_ORDER[a] ?? 999) - (TAG_ORDER[b] ?? 999))
    .map((t) => TAG_LABEL_MAP[t] || t);
}

export function getTagsByGroup(): { group: (typeof TAG_GROUPS)[number]; tags: TagDefinition[] }[] {
  return TAG_GROUPS.map((group) => ({ group, tags: TAGS.filter((t) => t.group === group.key) }));
}
