import type { WorkSpot } from "./types";

const STORAGE_KEY = "atlas_spots";

const SEED_DATA: WorkSpot[] = [
  {
    id: "seed-1",
    name: "The Grind Coffee House",
    category: "cafe",
    address: "245 Main St, Brooklyn, NY",
    lat: 40.6892,
    lng: -73.9857,
    ratings: { wifi: 4, power: 5, noise: 3, coffee: 5 },
    description: "Excellent espresso, plenty of outlets, and a calm atmosphere. Great for deep work sessions.",
    submittedAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "seed-2",
    name: "Central Public Library",
    category: "library",
    address: "476 5th Ave, New York, NY",
    lat: 40.7532,
    lng: -73.9822,
    ratings: { wifi: 5, power: 4, noise: 5, coffee: 1 },
    description: "Quiet study rooms, fast wifi, and beautiful architecture. No coffee inside but cafes nearby.",
    submittedAt: "2025-11-15T14:00:00Z",
  },
  {
    id: "seed-3",
    name: "WeWork Soho",
    category: "coworking",
    address: "154 Grand St, New York, NY",
    lat: 40.7216,
    lng: -73.9998,
    ratings: { wifi: 5, power: 5, noise: 3, coffee: 4 },
    description: "Professional coworking space with day passes available. Great community vibes.",
    submittedAt: "2025-10-20T09:00:00Z",
  },
  {
    id: "seed-4",
    name: "Prospect Park Boathouse",
    category: "park",
    address: "101 East Dr, Brooklyn, NY",
    lat: 40.665,
    lng: -73.9708,
    ratings: { wifi: 1, power: 1, noise: 4, coffee: 1 },
    description: "Beautiful outdoor spot. Bring your own hotspot and a fully charged laptop. Best in spring/summer.",
    submittedAt: "2025-09-10T11:00:00Z",
  },
  {
    id: "seed-5",
    name: "Blue Bottle Coffee",
    category: "cafe",
    address: "76 N 4th St, Brooklyn, NY",
    lat: 40.7168,
    lng: -73.9614,
    ratings: { wifi: 3, power: 3, noise: 2, coffee: 5 },
    description: "Top-tier coffee but limited seating. Best for short focused bursts, not all-day sessions.",
    submittedAt: "2025-08-05T15:00:00Z",
  },
  {
    id: "seed-6",
    name: "Brooklyn Public Library - Central",
    category: "library",
    address: "10 Grand Army Plaza, Brooklyn, NY",
    lat: 40.6724,
    lng: -73.9682,
    ratings: { wifi: 4, power: 4, noise: 5, coffee: 2 },
    description: "Beautiful art deco building. Second floor has the best study spots with natural light.",
    submittedAt: "2025-07-22T10:30:00Z",
  },
  {
    id: "seed-7",
    name: "The Wing - Dumbo",
    category: "coworking",
    address: "45 Main St, Brooklyn, NY",
    lat: 40.7024,
    lng: -73.9905,
    ratings: { wifi: 5, power: 5, noise: 4, coffee: 4 },
    description: "Beautifully designed coworking space. Quiet phone booths and strong espresso bar.",
    submittedAt: "2025-06-18T13:00:00Z",
  },
  {
    id: "seed-8",
    name: "Bryant Park",
    category: "park",
    address: "New York, NY 10018",
    lat: 40.7536,
    lng: -73.9832,
    ratings: { wifi: 3, power: 1, noise: 2, coffee: 3 },
    description: "Free public wifi in the park. Grab a coffee from nearby and find a table. Seasonal outdoor desks.",
    submittedAt: "2025-05-30T16:00:00Z",
  },
  {
    id: "seed-9",
    name: "Toby's Estate Coffee",
    category: "cafe",
    address: "125 N 6th St, Brooklyn, NY",
    lat: 40.7178,
    lng: -73.9588,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 5 },
    description: "Spacious Williamsburg cafe with communal tables. Excellent pour-overs and reliable wifi.",
    submittedAt: "2025-04-12T09:30:00Z",
  },
  {
    id: "seed-10",
    name: "Industrious - Dumbo",
    category: "coworking",
    address: "68 Jay St, Brooklyn, NY",
    lat: 40.7028,
    lng: -73.9866,
    ratings: { wifi: 5, power: 5, noise: 4, coffee: 3 },
    description: "Premium coworking with waterfront views. Day passes include meeting rooms and printing.",
    submittedAt: "2025-03-25T11:00:00Z",
  },
];

function getStoredSpots(): WorkSpot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
  return [...SEED_DATA];
}

function saveSpots(spots: WorkSpot[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
}

export function getAllSpots(): WorkSpot[] {
  return getStoredSpots();
}

export function addSpot(spot: Omit<WorkSpot, "id" | "submittedAt">): WorkSpot {
  const spots = getStoredSpots();
  const newSpot: WorkSpot = {
    ...spot,
    id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submittedAt: new Date().toISOString(),
  };
  spots.unshift(newSpot);
  saveSpots(spots);
  return newSpot;
}

export function deleteSpot(id: string): void {
  const spots = getStoredSpots().filter((s) => s.id !== id);
  saveSpots(spots);
}
