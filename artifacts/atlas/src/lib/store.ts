import type { WorkSpot } from "./types";

const STORAGE_KEY = "atlas_spots_v2";

const SEED_DATA: WorkSpot[] = [
  {
    id: "seed-1",
    name: "The Grind Coffee House",
    category: "cafe",
    city: "Brooklyn",
    address: "245 Main St, Brooklyn, NY",
    lat: 40.6892,
    lng: -73.9857,
    ratings: { wifi: 4, power: 5, noise: 3, coffee: 5, lighting: 4, seating: 4, outlets: 5 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: true, bus: true },
    description: "Excellent espresso, plenty of outlets, and a calm atmosphere. Great for deep work sessions.",
    aiSummary: "A well-equipped Brooklyn cafe with top-tier espresso, abundant outlets, and a calm atmosphere ideal for deep focus work. Fully accessible with excellent transit connections.",
    submittedAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "seed-2",
    name: "Central Public Library",
    category: "library",
    city: "New York",
    address: "476 5th Ave, New York, NY",
    lat: 40.7532,
    lng: -73.9822,
    ratings: { wifi: 5, power: 4, noise: 5, coffee: 1, lighting: 5, seating: 5, outlets: 4 },
    food: false,
    drink: false,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Quiet study rooms, fast wifi, and beautiful architecture. No coffee inside but cafes nearby.",
    aiSummary: "A stunning Midtown library offering ultra-quiet study rooms, blazing-fast wifi, and gorgeous natural light. No food or drink inside, but surrounded by cafes. ADA accessible.",
    submittedAt: "2025-11-15T14:00:00Z",
  },
  {
    id: "seed-3",
    name: "WeWork Soho",
    category: "coworking",
    city: "New York",
    address: "154 Grand St, New York, NY",
    lat: 40.7216,
    lng: -73.9998,
    ratings: { wifi: 5, power: 5, noise: 3, coffee: 4, lighting: 4, seating: 5, outlets: 5 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Professional coworking space with day passes available. Great community vibes.",
    aiSummary: "A professional Soho coworking space with day passes, strong wifi, ample power, and a lively community. Food and drinks available on-site. Fully ADA accessible.",
    submittedAt: "2025-10-20T09:00:00Z",
  },
  {
    id: "seed-4",
    name: "Prospect Park Boathouse",
    category: "park",
    city: "Brooklyn",
    address: "101 East Dr, Brooklyn, NY",
    lat: 40.665,
    lng: -73.9708,
    ratings: { wifi: 1, power: 1, noise: 4, coffee: 1, lighting: 5, seating: 3, outlets: 1 },
    food: false,
    drink: false,
    ada: false,
    transit: { walking: true, biking: true, driving: true, train: true, bus: true },
    description: "Beautiful outdoor spot. Bring your own hotspot and a fully charged laptop. Best in spring/summer.",
    aiSummary: "A scenic Brooklyn park with beautiful natural lighting but minimal infrastructure. BYO hotspot and a full battery. Best enjoyed in warmer months for a change of scenery.",
    submittedAt: "2025-09-10T11:00:00Z",
  },
  {
    id: "seed-5",
    name: "Blue Bottle Coffee",
    category: "cafe",
    city: "Brooklyn",
    address: "76 N 4th St, Brooklyn, NY",
    lat: 40.7168,
    lng: -73.9614,
    ratings: { wifi: 3, power: 3, noise: 2, coffee: 5, lighting: 4, seating: 2, outlets: 2 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Top-tier coffee but limited seating. Best for short focused bursts, not all-day sessions.",
    aiSummary: "Premium Williamsburg cafe with outstanding coffee and good natural light, but limited seating and outlets. Best for short, focused work sprints rather than marathon sessions.",
    submittedAt: "2025-08-05T15:00:00Z",
  },
  {
    id: "seed-6",
    name: "Brooklyn Public Library - Central",
    category: "library",
    city: "Brooklyn",
    address: "10 Grand Army Plaza, Brooklyn, NY",
    lat: 40.6724,
    lng: -73.9682,
    ratings: { wifi: 4, power: 4, noise: 5, coffee: 2, lighting: 5, seating: 4, outlets: 4 },
    food: false,
    drink: false,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: true, bus: true },
    description: "Beautiful art deco building. Second floor has the best study spots with natural light.",
    aiSummary: "A magnificent art deco library with exceptional natural lighting on the second floor. Ultra-quiet with reliable wifi and power. No food, but well-connected by all transit modes. ADA accessible.",
    submittedAt: "2025-07-22T10:30:00Z",
  },
  {
    id: "seed-7",
    name: "The Wing - Dumbo",
    category: "coworking",
    city: "Brooklyn",
    address: "45 Main St, Brooklyn, NY",
    lat: 40.7024,
    lng: -73.9905,
    ratings: { wifi: 5, power: 5, noise: 4, coffee: 4, lighting: 5, seating: 5, outlets: 5 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Beautifully designed coworking space. Quiet phone booths and strong espresso bar.",
    aiSummary: "An elegantly designed Dumbo coworking space with top-notch amenities: fast wifi, abundant outlets, quiet phone booths, and a strong espresso bar. Fully accessible and transit-friendly.",
    submittedAt: "2025-06-18T13:00:00Z",
  },
  {
    id: "seed-8",
    name: "Bryant Park",
    category: "park",
    city: "New York",
    address: "New York, NY 10018",
    lat: 40.7536,
    lng: -73.9832,
    ratings: { wifi: 3, power: 1, noise: 2, coffee: 3, lighting: 5, seating: 3, outlets: 1 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Free public wifi in the park. Grab a coffee from nearby and find a table. Seasonal outdoor desks.",
    aiSummary: "Midtown's iconic park with free public wifi and seasonal outdoor desks. No outlets, but surrounded by food and coffee options. Great natural lighting and ADA accessible.",
    submittedAt: "2025-05-30T16:00:00Z",
  },
  {
    id: "seed-9",
    name: "Toby's Estate Coffee",
    category: "cafe",
    city: "Brooklyn",
    address: "125 N 6th St, Brooklyn, NY",
    lat: 40.7178,
    lng: -73.9588,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 5, lighting: 4, seating: 4, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Spacious Williamsburg cafe with communal tables. Excellent pour-overs and reliable wifi.",
    aiSummary: "A spacious Williamsburg cafe with communal tables, excellent pour-over coffee, and reliable wifi. Good lighting, ample seating, and plenty of outlets for longer sessions. Fully accessible.",
    submittedAt: "2025-04-12T09:30:00Z",
  },
  {
    id: "seed-10",
    name: "Industrious - Dumbo",
    category: "coworking",
    city: "Brooklyn",
    address: "68 Jay St, Brooklyn, NY",
    lat: 40.7028,
    lng: -73.9866,
    ratings: { wifi: 5, power: 5, noise: 4, coffee: 3, lighting: 4, seating: 5, outlets: 5 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: true, bus: true },
    description: "Premium coworking with waterfront views. Day passes include meeting rooms and printing.",
    aiSummary: "A premium Dumbo coworking space with waterfront views, day passes, and included meeting rooms. Top-tier wifi and power with food and drinks available. ADA accessible.",
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

export function updateSpot(id: string, updates: Partial<WorkSpot>): void {
  const spots = getStoredSpots();
  const idx = spots.findIndex((s) => s.id === id);
  if (idx !== -1) {
    spots[idx] = { ...spots[idx], ...updates };
    saveSpots(spots);
  }
}

export function deleteSpot(id: string): void {
  const spots = getStoredSpots().filter((s) => s.id !== id);
  saveSpots(spots);
}
