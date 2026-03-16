export type Category = "cafe" | "library" | "coworking" | "park";

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "cafe", label: "Cafe", icon: "☕" },
  { value: "library", label: "Library", icon: "📚" },
  { value: "coworking", label: "Coworking", icon: "💼" },
  { value: "park", label: "Park", icon: "🌳" },
];

export type ScoreCategory = "wifi" | "outlets" | "food" | "environment" | "hours" | "access";

export type CategoryScores = Record<ScoreCategory, number>;

export const EMPTY_SCORES: CategoryScores = {
  wifi: 0,
  outlets: 0,
  food: 0,
  environment: 0,
  hours: 0,
  access: 0,
};

export type TagId =
  | "wifi_fast" | "wifi_reliable" | "wifi_password_free" | "cell_signal_strong"
  | "outlets_every_seat" | "outlets_ample" | "outlets_limited" | "standing_desk"
  | "noise_quiet" | "noise_moderate" | "natural_light" | "temp_controlled" | "seating_comfortable" | "table_space"
  | "open_early" | "open_late" | "no_time_limit" | "walk_in" | "reservation_available"
  | "coffee_quality" | "food_available" | "water_refill" | "alcohol_available"
  | "ada_entrance" | "ada_restroom" | "transit_nearby" | "bike_rack" | "parking_free";

export interface TagDefinition {
  id: TagId;
  label: string;
  category: ScoreCategory;
}

export interface TagCategoryGroup {
  key: ScoreCategory;
  label: string;
  baseWeight: number;
  tags: TagDefinition[];
}

export const TAG_CATEGORIES: TagCategoryGroup[] = [
  {
    key: "wifi", label: "WiFi", baseWeight: 0.25,
    tags: [
      { id: "wifi_fast", label: "Fast WiFi (50+ Mbps)", category: "wifi" },
      { id: "wifi_reliable", label: "Reliable connection", category: "wifi" },
      { id: "wifi_password_free", label: "No password needed", category: "wifi" },
      { id: "cell_signal_strong", label: "Strong cell signal", category: "wifi" },
    ],
  },
  {
    key: "outlets", label: "Outlets", baseWeight: 0.20,
    tags: [
      { id: "outlets_every_seat", label: "Outlet at every seat", category: "outlets" },
      { id: "outlets_ample", label: "Ample outlets", category: "outlets" },
      { id: "outlets_limited", label: "Limited outlets", category: "outlets" },
      { id: "standing_desk", label: "Standing desk available", category: "outlets" },
    ],
  },
  {
    key: "environment", label: "Environment", baseWeight: 0.20,
    tags: [
      { id: "noise_quiet", label: "Quiet / library-level", category: "environment" },
      { id: "noise_moderate", label: "Moderate background noise", category: "environment" },
      { id: "natural_light", label: "Good natural light", category: "environment" },
      { id: "temp_controlled", label: "Climate controlled", category: "environment" },
      { id: "seating_comfortable", label: "Comfortable seating", category: "environment" },
      { id: "table_space", label: "Generous table space", category: "environment" },
    ],
  },
  {
    key: "hours", label: "Hours", baseWeight: 0.15,
    tags: [
      { id: "open_early", label: "Opens before 8am", category: "hours" },
      { id: "open_late", label: "Open past 8pm", category: "hours" },
      { id: "no_time_limit", label: "No time limit enforced", category: "hours" },
      { id: "walk_in", label: "Walk-in friendly", category: "hours" },
      { id: "reservation_available", label: "Reservations available", category: "hours" },
    ],
  },
  {
    key: "food", label: "Food & Beverage", baseWeight: 0.10,
    tags: [
      { id: "coffee_quality", label: "Good coffee", category: "food" },
      { id: "food_available", label: "Food menu available", category: "food" },
      { id: "water_refill", label: "Free water refill", category: "food" },
      { id: "alcohol_available", label: "Beer/wine available", category: "food" },
    ],
  },
  {
    key: "access", label: "Accessibility", baseWeight: 0.10,
    tags: [
      { id: "ada_entrance", label: "ADA accessible entrance", category: "access" },
      { id: "ada_restroom", label: "ADA restroom", category: "access" },
      { id: "transit_nearby", label: "Transit stop within 5 min walk", category: "access" },
      { id: "bike_rack", label: "Bike rack available", category: "access" },
      { id: "parking_free", label: "Free parking nearby", category: "access" },
    ],
  },
];

const TAG_LABEL_MAP: Record<string, string> = {};
const TAG_CATEGORY_MAP: Record<string, ScoreCategory> = {};
TAG_CATEGORIES.forEach((group) => {
  group.tags.forEach((tag) => {
    TAG_LABEL_MAP[tag.id] = tag.label;
    TAG_CATEGORY_MAP[tag.id] = tag.category;
  });
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

const TAG_WEIGHT_BONUS = 0.02;

export function calcScore(scores: CategoryScores, tags: TagId[]): number {
  const tagCounts: Record<ScoreCategory, number> = {
    wifi: 0, outlets: 0, food: 0, environment: 0, hours: 0, access: 0,
  };
  tags.forEach((t) => {
    const cat = TAG_CATEGORY_MAP[t];
    if (cat) tagCounts[cat]++;
  });

  const rawWeights: Record<ScoreCategory, number> = {} as any;
  let totalWeight = 0;
  TAG_CATEGORIES.forEach((group) => {
    const w = group.baseWeight + tagCounts[group.key] * TAG_WEIGHT_BONUS;
    rawWeights[group.key] = w;
    totalWeight += w;
  });

  let result = 0;
  TAG_CATEGORIES.forEach((group) => {
    const normalizedWeight = rawWeights[group.key] / totalWeight;
    result += normalizedWeight * scores[group.key];
  });

  return Math.round(result * 10) / 10;
}

export function scoreToDots(score: number): string {
  const filled = Math.round(score);
  return "●".repeat(filled) + "○".repeat(5 - filled);
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

export function getSpotDisplayTags(spot: WorkSpot): string[] {
  return spot.tags.map((t) => TAG_LABEL_MAP[t] || t);
}

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  wifi: "WiFi",
  outlets: "Outlets",
  food: "Food & Beverage",
  environment: "Environment",
  hours: "Hours",
  access: "Accessibility",
};
