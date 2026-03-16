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

export function scoreToLabel(score: number): string {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Decent";
  return "Limited";
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
