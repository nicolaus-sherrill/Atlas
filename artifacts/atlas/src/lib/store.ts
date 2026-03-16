import type { WorkSpot } from "./types";

const STORAGE_KEY = "atlas_spots_v3";

const SEED_DATA: WorkSpot[] = [
  {
    id: "seed-1",
    name: "Codependent Coffee + Cocktails",
    category: "cafe",
    city: "Austin",
    address: "215 S Lamar Blvd, Austin, TX 78704",
    lat: 30.2594,
    lng: -97.7542,
    ratings: { wifi: 5, power: 4, noise: 3, coffee: 5, lighting: 5, seating: 5, outlets: 4 },
    food: false,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: false, bus: true },
    description: "Airy lounge with high-end design, big windows, modern furniture, and outdoor seating. Great espresso and dairy-free milk options.",
    aiSummary: "A beautifully designed Austin cafe with big windows, natural light, comfy furniture, and outdoor seating. Fast wifi, accessible outlets, and great coffee including dairy-free options. Bike racks available.",
    submittedAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "seed-2",
    name: "Mozart's Coffee Roasters",
    category: "cafe",
    city: "Austin",
    address: "3825 Lake Austin Blvd, Austin, TX 78703",
    lat: 30.2899,
    lng: -97.7884,
    ratings: { wifi: 4, power: 4, noise: 2, coffee: 5, lighting: 5, seating: 5, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: false, biking: true, driving: true, train: false, bus: true },
    description: "Family-friendly lakeside coffee roasters with a massive outdoor deck and live music. Long opening hours and diverse crowd.",
    aiSummary: "An iconic lakeside Austin cafe with a huge outdoor deck, live music, and spacious seating. Fast wifi, accessible outlets, dairy-free milk, and long hours. Parking and bike racks available.",
    submittedAt: "2025-11-28T09:00:00Z",
  },
  {
    id: "seed-3",
    name: "Mañana",
    category: "cafe",
    city: "Austin",
    address: "1603 S Congress Ave, Austin, TX 78704",
    lat: 30.2478,
    lng: -97.7490,
    ratings: { wifi: 3, power: 3, noise: 3, coffee: 4, lighting: 4, seating: 3, outlets: 3 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: false, bus: true },
    description: "Charming South Congress cafe with a relaxed vibe. Good coffee and a nice spot for casual remote work.",
    aiSummary: "A cozy South Congress cafe with good coffee and a laid-back Austin vibe. Walkable location with bus access and bike racks.",
    submittedAt: "2025-11-20T08:30:00Z",
  },
  {
    id: "seed-4",
    name: "Merit Coffee",
    category: "cafe",
    city: "Austin",
    address: "1180 S Lamar Blvd, Austin, TX 78704",
    lat: 30.2505,
    lng: -97.7635,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 5, lighting: 4, seating: 4, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: false, bus: true },
    description: "Clean, modern specialty coffee shop with reliable wifi and ample seating for remote workers.",
    aiSummary: "A sleek specialty coffee shop on South Lamar with excellent coffee, reliable wifi, and plenty of outlets. ADA accessible with good transit options.",
    submittedAt: "2025-11-15T10:00:00Z",
  },
  {
    id: "seed-5",
    name: "Strangelove Coffee & Wine",
    category: "cafe",
    city: "Austin",
    address: "404 Colorado St, Austin, TX 78701",
    lat: 30.2669,
    lng: -97.7443,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 5, lighting: 4, seating: 4, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: false, bus: true },
    description: "Wine bar and cafe hybrid in downtown Austin. Great coffee by day, wine by evening. Rating 4.6 on Google.",
    aiSummary: "A unique downtown Austin venue blending specialty coffee and wine. Excellent drinks, good wifi, and a comfortable work atmosphere. Rated 4.6 stars. Walkable and bus accessible.",
    submittedAt: "2025-11-10T11:00:00Z",
  },
  {
    id: "seed-6",
    name: "Medici Roasting - Springdale",
    category: "cafe",
    city: "Austin",
    address: "1101 Springdale Rd, Austin, TX 78721",
    lat: 30.2635,
    lng: -97.7050,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 5, lighting: 4, seating: 4, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: false, biking: true, driving: true, train: false, bus: true },
    description: "East Austin coffee shop with a spacious interior and strong espresso. Rated 4.4 on Google.",
    aiSummary: "A roomy East Austin coffee shop with top-notch roasting, solid wifi, and plenty of outlets. Rated 4.4 stars. Best reached by car or bike.",
    submittedAt: "2025-11-05T09:30:00Z",
  },
  {
    id: "seed-7",
    name: "First Light Book Shop",
    category: "cafe",
    city: "Austin",
    address: "1809 E Cesar Chavez St, Austin, TX 78702",
    lat: 30.2550,
    lng: -97.7267,
    ratings: { wifi: 3, power: 3, noise: 5, coffee: 3, lighting: 4, seating: 3, outlets: 3 },
    food: false,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: false, bus: true },
    description: "Quiet bookstore with a calm reading atmosphere. Perfect for focused work. Rated 4.7 on Google.",
    aiSummary: "A serene East Austin bookstore with a quiet, focused atmosphere ideal for deep work. Rated 4.7 stars. Limited outlets but great natural lighting and a peaceful vibe.",
    submittedAt: "2025-10-28T14:00:00Z",
  },
  {
    id: "seed-8",
    name: "Austin Central Library",
    category: "library",
    city: "Austin",
    address: "710 W Cesar Chavez St, Austin, TX 78701",
    lat: 30.2641,
    lng: -97.7526,
    ratings: { wifi: 5, power: 5, noise: 5, coffee: 2, lighting: 5, seating: 5, outlets: 5 },
    food: false,
    drink: false,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: false, bus: true },
    description: "Stunning modern library with rooftop garden, quiet study rooms, and blazing fast wifi. Rated 4.7 on Google.",
    aiSummary: "Austin's award-winning central library with a rooftop garden, quiet study rooms, fast wifi, and abundant outlets. Rated 4.7 stars. Fully ADA accessible with excellent transit connections.",
    submittedAt: "2025-10-20T10:00:00Z",
  },
  {
    id: "seed-9",
    name: "Mutual Friends Coffee",
    category: "cafe",
    city: "Austin",
    address: "88 San Jacinto Blvd, Austin, TX 78701",
    lat: 30.2649,
    lng: -97.7401,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 4, lighting: 4, seating: 4, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: false, train: false, bus: true },
    description: "Downtown coffee shop with a welcoming community vibe. Good seating and reliable wifi for remote work.",
    aiSummary: "A friendly downtown Austin coffee shop with solid wifi, good seating, and a community atmosphere. Walkable location near transit. Great for afternoon work sessions.",
    submittedAt: "2025-10-15T11:30:00Z",
  },
  {
    id: "seed-10",
    name: "Night Owl Video",
    category: "cafe",
    city: "Austin",
    address: "1620 E Riverside Dr, Austin, TX 78741",
    lat: 30.2395,
    lng: -97.7297,
    ratings: { wifi: 3, power: 3, noise: 2, coffee: 3, lighting: 3, seating: 3, outlets: 3 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: false, biking: true, driving: true, train: false, bus: true },
    description: "Unique Austin venue doubling as a casual work spot. Quirky atmosphere and late hours.",
    aiSummary: "A uniquely Austin venue with a quirky atmosphere and late-night hours. Decent wifi and a fun change of pace for remote workers who like offbeat spots.",
    submittedAt: "2025-10-10T15:00:00Z",
  },
  {
    id: "seed-11",
    name: "Daydreamer Coffee",
    category: "cafe",
    city: "Austin",
    address: "2820 E Martin Luther King Jr Blvd, Austin, TX 78702",
    lat: 30.2802,
    lng: -97.7139,
    ratings: { wifi: 4, power: 4, noise: 3, coffee: 5, lighting: 4, seating: 4, outlets: 4 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: false, biking: true, driving: true, train: false, bus: true },
    description: "East Austin coffee shop with excellent specialty drinks and a bright, open interior great for work.",
    aiSummary: "A bright, open East Austin coffee shop with excellent specialty coffee, reliable wifi, and good outlet access. Comfortable seating and a creative atmosphere.",
    submittedAt: "2025-10-05T09:00:00Z",
  },
  {
    id: "seed-12",
    name: "Desnudo Coffee: South Lamar",
    category: "cafe",
    city: "Austin",
    address: "1621 S Lamar Blvd, Austin, TX 78704",
    lat: 30.2445,
    lng: -97.7703,
    ratings: { wifi: 4, power: 3, noise: 3, coffee: 5, lighting: 4, seating: 3, outlets: 3 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: true, biking: true, driving: true, train: false, bus: true },
    description: "Minimalist South Lamar coffee shop with outstanding single-origin brews and a clean aesthetic.",
    aiSummary: "A minimalist South Lamar coffee shop known for exceptional single-origin coffee. Clean design, good lighting, and decent wifi. Compact but comfortable for focused work.",
    submittedAt: "2025-09-28T10:30:00Z",
  },
  {
    id: "seed-13",
    name: "Kyoko Coffee",
    category: "cafe",
    city: "Austin",
    address: "4631 Airport Blvd Ste 100, Austin, TX 78751",
    lat: 30.3075,
    lng: -97.7149,
    ratings: { wifi: 4, power: 3, noise: 3, coffee: 5, lighting: 4, seating: 3, outlets: 3 },
    food: true,
    drink: true,
    ada: true,
    transit: { walking: false, biking: true, driving: true, train: false, bus: true },
    description: "Japanese-inspired Austin coffee shop with beautifully crafted drinks and a serene atmosphere.",
    aiSummary: "A Japanese-inspired coffee shop in North Austin with meticulously crafted drinks and a calm, minimalist interior. Good wifi and a peaceful setting for focused work.",
    submittedAt: "2025-09-20T08:00:00Z",
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
