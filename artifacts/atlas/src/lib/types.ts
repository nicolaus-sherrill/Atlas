export type Category = "cafe" | "library" | "coworking" | "park";

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "cafe", label: "Cafe", icon: "☕" },
  { value: "library", label: "Library", icon: "📚" },
  { value: "coworking", label: "Coworking", icon: "💼" },
  { value: "park", label: "Park", icon: "🌳" },
];

export type TagId =
  | "wifi_fast" | "wifi_reliable" | "wifi_password_free" | "cell_signal_strong"
  | "outlets_every_seat" | "outlets_ample" | "outlets_limited" | "standing_desk"
  | "noise_quiet" | "noise_moderate" | "natural_light" | "temp_controlled" | "seating_comfortable" | "table_space"
  | "open_early" | "open_late" | "no_time_limit" | "walk_in" | "reservation_available"
  | "coffee_quality" | "food_available" | "water_refill" | "alcohol_available"
  | "ada_entrance" | "ada_restroom" | "transit_nearby" | "bike_rack" | "parking_free";

export type ScoreCategory = "wifi" | "outlets" | "environment" | "hours" | "food" | "access";

export interface TagDefinition {
  id: TagId;
  label: string;
  points: number;
  category: ScoreCategory;
}

export interface TagCategoryGroup {
  key: ScoreCategory;
  label: string;
  weight: number;
  max: number;
  tags: TagDefinition[];
}

export const TAG_CATEGORIES: TagCategoryGroup[] = [
  {
    key: "wifi", label: "WiFi & Connectivity", weight: 0.25, max: 10,
    tags: [
      { id: "wifi_fast", label: "Fast WiFi (50+ Mbps)", points: 4, category: "wifi" },
      { id: "wifi_reliable", label: "Reliable connection", points: 3, category: "wifi" },
      { id: "wifi_password_free", label: "No password needed", points: 2, category: "wifi" },
      { id: "cell_signal_strong", label: "Strong cell signal", points: 1, category: "wifi" },
    ],
  },
  {
    key: "outlets", label: "Outlets & Power", weight: 0.20, max: 10,
    tags: [
      { id: "outlets_every_seat", label: "Outlet at every seat", points: 5, category: "outlets" },
      { id: "outlets_ample", label: "Ample outlets", points: 3, category: "outlets" },
      { id: "outlets_limited", label: "Limited outlets", points: 1, category: "outlets" },
      { id: "standing_desk", label: "Standing desk available", points: 1, category: "outlets" },
    ],
  },
  {
    key: "environment", label: "Environment", weight: 0.20, max: 10,
    tags: [
      { id: "noise_quiet", label: "Quiet / library-level", points: 4, category: "environment" },
      { id: "noise_moderate", label: "Moderate background noise", points: 2, category: "environment" },
      { id: "natural_light", label: "Good natural light", points: 2, category: "environment" },
      { id: "temp_controlled", label: "Climate controlled", points: 1, category: "environment" },
      { id: "seating_comfortable", label: "Comfortable seating", points: 1, category: "environment" },
      { id: "table_space", label: "Generous table space", points: 2, category: "environment" },
    ],
  },
  {
    key: "hours", label: "Hours & Logistics", weight: 0.15, max: 10,
    tags: [
      { id: "open_early", label: "Opens before 8am", points: 2, category: "hours" },
      { id: "open_late", label: "Open past 8pm", points: 2, category: "hours" },
      { id: "no_time_limit", label: "No time limit enforced", points: 3, category: "hours" },
      { id: "walk_in", label: "Walk-in friendly", points: 2, category: "hours" },
      { id: "reservation_available", label: "Reservations available", points: 1, category: "hours" },
    ],
  },
  {
    key: "food", label: "Food & Beverage", weight: 0.10, max: 10,
    tags: [
      { id: "coffee_quality", label: "Good coffee", points: 3, category: "food" },
      { id: "food_available", label: "Food menu available", points: 3, category: "food" },
      { id: "water_refill", label: "Free water refill", points: 2, category: "food" },
      { id: "alcohol_available", label: "Beer/wine available", points: 2, category: "food" },
    ],
  },
  {
    key: "access", label: "Accessibility", weight: 0.10, max: 10,
    tags: [
      { id: "ada_entrance", label: "ADA accessible entrance", points: 3, category: "access" },
      { id: "ada_restroom", label: "ADA restroom", points: 2, category: "access" },
      { id: "transit_nearby", label: "Transit stop within 5 min walk", points: 2, category: "access" },
      { id: "bike_rack", label: "Bike rack available", points: 2, category: "access" },
      { id: "parking_free", label: "Free parking nearby", points: 1, category: "access" },
    ],
  },
];

const TAG_MAP: Record<string, [ScoreCategory, number]> = {};
const TAG_LABEL_MAP: Record<string, string> = {};
TAG_CATEGORIES.forEach((group) => {
  group.tags.forEach((tag) => {
    TAG_MAP[tag.id] = [tag.category, tag.points];
    TAG_LABEL_MAP[tag.id] = tag.label;
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
  tags: TagId[];
  description: string;
  aiSummary?: string;
  submittedAt: string;
}

export function calcScore(tags: string[]): number {
  const categories: Record<ScoreCategory, { weight: number; max: number; pts: number }> = {
    wifi: { weight: 0.25, max: 10, pts: 0 },
    outlets: { weight: 0.20, max: 10, pts: 0 },
    environment: { weight: 0.20, max: 10, pts: 0 },
    hours: { weight: 0.15, max: 10, pts: 0 },
    food: { weight: 0.10, max: 10, pts: 0 },
    access: { weight: 0.10, max: 10, pts: 0 },
  };

  tags.forEach((tag) => {
    const entry = TAG_MAP[tag];
    if (entry) {
      const [cat, pts] = entry;
      categories[cat].pts = Math.min(categories[cat].max, categories[cat].pts + pts);
    }
  });

  const raw = Object.values(categories).reduce((sum, c) => {
    return sum + (c.pts / c.max) * c.weight;
  }, 0);

  return Math.round(raw * 50) / 10;
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
