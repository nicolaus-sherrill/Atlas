export interface WorkSpot {
  id: string;
  name: string;
  category: "cafe" | "library" | "coworking" | "park";
  address: string;
  lat: number;
  lng: number;
  ratings: {
    wifi: number;
    power: number;
    noise: number;
    coffee: number;
  };
  description: string;
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
};
