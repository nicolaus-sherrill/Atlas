export type Category = "cafe" | "library" | "coworking" | "park";

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "cafe", label: "Cafe", icon: "☕" },
  { value: "library", label: "Library", icon: "📚" },
  { value: "coworking", label: "Coworking", icon: "💼" },
  { value: "park", label: "Park", icon: "🌳" },
];

export type ScoreCategory = "wifi" | "outlets" | "food" | "atmosphere" | "hours" | "access";

export type CategoryScores = Record<ScoreCategory, number>;

export const EMPTY_SCORES: CategoryScores = {
  wifi: 1,
  outlets: 1,
  food: 1,
  atmosphere: 1,
  hours: 1,
  access: 1,
};

export type TagId =
  | "natural_lighting" | "open_late" | "quiet" | "food" | "alcohol"
  | "ada_accessible" | "bike_racks" | "transit_nearby" | "outdoor_seating"
  | "free_parking" | "laptop_friendly" | "wifi_portal" | "no_wifi_password"
  | "generous_seating";

export interface TagDefinition {
  id: TagId;
  label: string;
  category: ScoreCategory;
}

export const TAGS: TagDefinition[] = [
  { id: "wifi_portal", label: "WiFi Network Portal", category: "wifi" },
  { id: "no_wifi_password", label: "No WiFi Password", category: "wifi" },
  { id: "natural_lighting", label: "Natural Lighting", category: "atmosphere" },
  { id: "quiet", label: "Quiet", category: "atmosphere" },
  { id: "outdoor_seating", label: "Outdoor Seating", category: "atmosphere" },
  { id: "laptop_friendly", label: "Laptop-Friendly", category: "atmosphere" },
  { id: "generous_seating", label: "Generous Seating", category: "atmosphere" },
  { id: "open_late", label: "Open Late", category: "hours" },
  { id: "food", label: "Food", category: "food" },
  { id: "alcohol", label: "Alcohol", category: "food" },
  { id: "ada_accessible", label: "ADA Accessible", category: "access" },
  { id: "bike_racks", label: "Bike Racks Available", category: "access" },
  { id: "transit_nearby", label: "Transit Stop Nearby", category: "access" },
  { id: "free_parking", label: "Free Parking Nearby", category: "access" },
];

export interface ScoreCategoryDef {
  key: ScoreCategory;
  label: string;
  baseWeight: number;
}

export const SCORE_CATEGORIES: ScoreCategoryDef[] = [
  { key: "wifi", label: "WiFi", baseWeight: 0.25 },
  { key: "outlets", label: "Outlets", baseWeight: 0.20 },
  { key: "atmosphere", label: "Atmosphere", baseWeight: 0.20 },
  { key: "hours", label: "Hours", baseWeight: 0.15 },
  { key: "food", label: "Food & Beverage", baseWeight: 0.10 },
  { key: "access", label: "Accessibility", baseWeight: 0.10 },
];

const TAG_LABEL_MAP: Record<string, string> = {};
const TAG_CATEGORY_MAP: Record<string, ScoreCategory> = {};
TAGS.forEach((tag) => {
  TAG_LABEL_MAP[tag.id] = tag.label;
  TAG_CATEGORY_MAP[tag.id] = tag.category;
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

const TAG_WEIGHT_BONUS = 0.03;

export function calcScore(tagsOrScores: TagId[] | CategoryScores, tags?: TagId[]): number {
  let actualScores: CategoryScores;
  let actualTags: TagId[];

  if (Array.isArray(tagsOrScores)) {
    actualTags = tagsOrScores;
    actualScores = { wifi: 0, outlets: 0, food: 0, atmosphere: 0, hours: 0, access: 0 };
    actualTags.forEach((t) => {
      const cat = TAG_CATEGORY_MAP[t];
      if (cat) actualScores[cat] = Math.min(5, actualScores[cat] + 1);
    });
  } else {
    actualScores = tagsOrScores;
    actualTags = tags || [];
  }

  const tagCounts: Record<ScoreCategory, number> = {
    wifi: 0, outlets: 0, food: 0, atmosphere: 0, hours: 0, access: 0,
  };
  actualTags.forEach((t) => {
    const cat = TAG_CATEGORY_MAP[t];
    if (cat) tagCounts[cat]++;
  });

  const rawWeights: Record<ScoreCategory, number> = {} as any;
  let totalWeight = 0;
  SCORE_CATEGORIES.forEach((sc) => {
    const w = sc.baseWeight + tagCounts[sc.key] * TAG_WEIGHT_BONUS;
    rawWeights[sc.key] = w;
    totalWeight += w;
  });

  let result = 0;
  SCORE_CATEGORIES.forEach((sc) => {
    const normalizedWeight = rawWeights[sc.key] / totalWeight;
    result += normalizedWeight * actualScores[sc.key];
  });

  return Math.round(result * 10) / 10;
}

export function getTagLabel(tagId: string): string {
  return TAG_LABEL_MAP[tagId] || tagId;
}

const TAG_ORDER: Record<string, number> = Object.fromEntries(TAGS.map((t, i) => [t.id, i]));

export function getSpotDisplayTags(spot: WorkSpot): string[] {
  return [...spot.tags]
    .sort((a, b) => (TAG_ORDER[a] ?? 999) - (TAG_ORDER[b] ?? 999))
    .map((t) => TAG_LABEL_MAP[t] || t);
}

export function getTagsGroupedByCategory(): { category: ScoreCategoryDef; tags: TagDefinition[] }[] {
  const groups: { category: ScoreCategoryDef; tags: TagDefinition[] }[] = [];
  SCORE_CATEGORIES.forEach((sc) => {
    const catTags = TAGS.filter((t) => t.category === sc.key);
    if (catTags.length > 0) {
      groups.push({ category: sc, tags: catTags });
    }
  });
  return groups;
}

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  wifi: "WiFi",
  outlets: "Outlets",
  food: "Food & Beverage",
  atmosphere: "Atmosphere",
  hours: "Hours",
  access: "Accessibility",
};
