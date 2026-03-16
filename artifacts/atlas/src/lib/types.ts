export interface TransitAccess {
  walking: boolean;
  biking: boolean;
  driving: boolean;
  train: boolean;
  bus: boolean;
}

export interface WorkSpot {
  id: string;
  name: string;
  category: "cafe" | "library" | "coworking" | "park";
  city: string;
  address: string;
  lat: number;
  lng: number;
  ratings: {
    wifi: number;
    power: number;
    noise: number;
    coffee: number;
    lighting: number;
    seating: number;
    outlets: number;
  };
  food: boolean;
  drink: boolean;
  ada: boolean;
  transit: TransitAccess;
  description: string;
  aiSummary?: string;
  submittedAt: string;
}

export type Category = WorkSpot["category"];

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "cafe", label: "Cafe", icon: "☕" },
  { value: "library", label: "Library", icon: "📚" },
  { value: "coworking", label: "Coworking", icon: "💼" },
  { value: "park", label: "Park", icon: "🌳" },
];

export const RATING_LABELS: Record<keyof WorkSpot["ratings"], string> = {
  wifi: "WiFi",
  power: "Power",
  noise: "Noise Level",
  coffee: "Coffee",
  lighting: "Lighting",
  seating: "Seating",
  outlets: "Outlets",
};

export const TRANSIT_LABELS: Record<keyof TransitAccess, { label: string; icon: string }> = {
  walking: { label: "Walking", icon: "🚶" },
  biking: { label: "Biking", icon: "🚲" },
  driving: { label: "Driving", icon: "🚗" },
  train: { label: "Train", icon: "🚆" },
  bus: { label: "Bus", icon: "🚌" },
};

export type TagKey = "food" | "drink" | "ada";

export const TAG_LABELS: Record<TagKey, { label: string; icon: string }> = {
  food: { label: "Food", icon: "🍽️" },
  drink: { label: "Drinks", icon: "🥤" },
  ada: { label: "ADA Accessible", icon: "♿" },
};

export function computeWorkabilityScore(spot: WorkSpot): number {
  const r = spot.ratings;
  const ratingAvg = (r.wifi + r.power + r.noise + r.coffee + r.lighting + r.seating + r.outlets) / 7;

  let amenityBonus = 0;
  let amenityCount = 0;
  if (spot.food) { amenityBonus += 1; amenityCount++; }
  if (spot.drink) { amenityBonus += 1; amenityCount++; }
  if (spot.ada) { amenityBonus += 1; amenityCount++; }

  const transitModes = Object.values(spot.transit).filter(Boolean).length;
  const transitBonus = (transitModes / 5) * 1;

  const score = ratingAvg * 0.75 + (amenityBonus / 3) * 0.6 + transitBonus * 0.65;
  return Math.min(5, Math.round(score * 10) / 10);
}

export function getSpotTags(spot: WorkSpot): string[] {
  const tags: string[] = [];
  if (spot.food) tags.push("Food");
  if (spot.drink) tags.push("Drinks");
  if (spot.ada) tags.push("ADA");
  if (spot.transit.walking) tags.push("Walking");
  if (spot.transit.biking) tags.push("Biking");
  if (spot.transit.driving) tags.push("Driving");
  if (spot.transit.train) tags.push("Train");
  if (spot.transit.bus) tags.push("Bus");
  if (spot.ratings.lighting >= 4) tags.push("Good Lighting");
  if (spot.ratings.seating >= 4) tags.push("Great Seating");
  if (spot.ratings.outlets >= 4) tags.push("Many Outlets");
  if (spot.ratings.wifi >= 4) tags.push("Fast WiFi");
  return tags;
}
