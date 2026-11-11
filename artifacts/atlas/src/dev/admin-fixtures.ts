// Stand-in for lib/admin-data.ts under `vite --mode adminfixture` (see vite.config.ts), so the signed-in
// admin page can be opened and checked with no account, email link or database. Data lives in memory,
// the moderation buttons work on it, and a reload resets it. Never part of a production build.

import type { AdminRating, AdminReview, AdminSpot, DeletedSpot, PendingEdit, ProblemReport, SpotSnapshot } from "../lib/admin-data";

export type { AdminRating, AdminReview, AdminSpot, DeletedSpot, PendingEdit, ProblemReport, SpotSnapshot };

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 80));

const HOURS = (open: string, close: string, closedDays: string[] = []) =>
  Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => [d, { closed: closedDays.includes(d), open, close }]),
  ) as SpotSnapshot["operating_hours"];

const medici: SpotSnapshot = {
  name: "Medici Roasting",
  category: "cafe",
  good_for: ["work", "gather"],
  paid_entry: false,
  city: "Austin",
  address: "1101 W Lynn St, Austin, TX 78703",
  lat: 30.2776,
  lng: -97.7527,
  tags: ["natural_lighting", "laptop_friendly"],
  description: "Bright corner cafe with long shared tables.",
  operating_hours: HOURS("07:00", "19:00"),
  website: "https://example.com/medici",
};
const park: SpotSnapshot = {
  name: "Pease District Park",
  category: "park",
  good_for: ["gather"],
  paid_entry: false,
  city: "Austin",
  address: "1100 Kingsbury St, Austin, TX 78701",
  lat: 30.2805,
  lng: -97.7484,
  tags: ["outdoor_seating", "shade"],
  description: "Shaded lawn and picnic tables near downtown.",
  operating_hours: null,
  website: null,
};
const museum: SpotSnapshot = {
  name: "Blanton Museum of Art, University of Texas at Austin",
  category: "museum",
  good_for: ["gather", "create"],
  paid_entry: true,
  city: "Austin",
  address: "200 E Martin Luther King Jr Blvd, Austin, TX 78712",
  lat: 30.2807,
  lng: -97.7385,
  tags: ["ada_accessible"],
  description: "",
  operating_hours: HOURS("10:00", "17:00", ["monday"]),
  website: "https://example.com/blanton",
};

let edits: PendingEdit[] = [
  {
    id: "e1",
    spot_id: "s1",
    created_at: ago(35),
    note: "They moved to later hours in the summer and the website is wrong.",
    changes: { operating_hours: HOURS("08:00", "21:00"), website: "https://medici.example.com", description: "Bright corner cafe with long shared tables and an outdoor patio." },
    spot: medici,
  },
  {
    id: "e2",
    spot_id: "s2",
    created_at: ago(60 * 26),
    note: "",
    changes: { category: "bookstore", good_for: ["gather", "create"], paid_entry: true, tags: ["outdoor_seating", "shade", "dog_friendly"] },
    spot: park,
  },
  { id: "e3", spot_id: "s3", created_at: ago(60 * 70), note: "Free on Thursdays.", changes: { paid_entry: false, lat: 30.2811, lng: -97.7391 }, spot: museum },
];

let reports: ProblemReport[] = [
  { id: "r1", spot_id: "s1", reason: "closed", details: "Permanently closed, the windows are papered over.", status: "open", created_at: ago(20), spot: { name: "Medici Roasting", city: "Austin" } },
  { id: "r2", spot_id: "s2", reason: "wrong_info", details: "", status: "open", created_at: ago(60 * 5), spot: { name: "Pease District Park", city: "Austin" } },
  { id: "r3", spot_id: "s3", reason: "inappropriate", details: "The description links to a casino site and goes on for several lines so we can see how long details wrap in the card.", status: "open", created_at: ago(60 * 30), spot: { name: "Blanton Museum of Art, University of Texas at Austin", city: "Austin" } },
];

const rating = (id: string, user: string | null, scores: AdminRating["scores"], minutesAgo: number, status: AdminRating["status"] = "visible", spotName = "Medici Roasting"): AdminRating => ({
  id,
  spot_id: "s1",
  user_id: user,
  scores,
  status,
  created_at: ago(minutesAgo),
  updated_at: ago(minutesAgo),
  spot: { name: spotName, scores: { seating: 4, wifi: 4, outlets: 3, atmosphere: 4 }, rating_count: 7 },
});
const SPAMMER = "9f3c1a7e-5b2d-4c1e-8a6f-0d4e2b7c9a11";
let ratings: AdminRating[] = [
  ...[0, 5, 11, 18, 26, 33].map((m, i) => rating(`b${i}`, SPAMMER, { seating: 5, wifi: 5, outlets: 5, food: 5, atmosphere: 5, access: 5 }, m + 2, "visible", ["Medici Roasting", "Cosmic Pickle", "The Sentinel", "Mañana", "Merit Coffee", "Desnudo Coffee"][i])),
  rating("g1", "2b7c9a11-0d4e-4c1e-8a6f-5b2d9f3c1a7e", { seating: 1, wifi: 1, outlets: 1, atmosphere: 1 }, 90),
  rating("g2", null, { seating: 4, wifi: 3, outlets: 4, atmosphere: 5 }, 60 * 4, "hidden"),
  rating("g3", "c1e8a6f0-5b2d-4c1e-9f3c-1a7e0d4e2b7c", { seating: 3, wifi: 4 }, 60 * 30),
];

let reviews: AdminReview[] = [
  { id: "v1", spot_id: "s1", user_id: "2b7c9a11-0d4e-4c1e-8a6f-5b2d9f3c1a7e", body: "Great light and plenty of outlets along the back wall.", status: "visible", created_at: ago(300), updated_at: ago(300), spot: { name: "Medici Roasting" } },
  { id: "v2", spot_id: "s2", user_id: null, body: "Buy cheap followers at example.invalid, a very long unbroken run of review text that keeps going to see how the table copes with a lot of words in one cell and whether it stays readable.", status: "hidden", created_at: ago(900), updated_at: ago(900), spot: { name: "Pease District Park" } },
];

let spots: AdminSpot[] = [
  { id: "s1", name: "Medici Roasting", city: "Austin", address: medici.address, category: "cafe", osm_type: "node", osm_id: 123456, rating_count: 7, created_at: ago(60 * 24 * 40) },
  { id: "s2", name: "Pease District Park", city: "Austin", address: park.address, category: "park", osm_type: null, osm_id: null, rating_count: 0, created_at: ago(60 * 24 * 30) },
  { id: "s3", name: museum.name, city: "Austin", address: museum.address, category: "museum", osm_type: null, osm_id: null, rating_count: 2, created_at: ago(60 * 24 * 20) },
];

let deleted: DeletedSpot[] = [{ id: 1, spot_id: "s9", name: "Old Test Spot", city: "Austin", rating_count: 3, deleted_at: ago(60 * 24 * 4) }];

// ---------- the admin-data.ts API ----------

export async function sendSignInLink(): Promise<void> {}
export async function signOut(): Promise<void> {}

export const fetchPendingEdits = () => wait(edits);
export async function reviewEdit(id: string): Promise<void> {
  edits = edits.filter((e) => e.id !== id);
  await wait(0);
}
export const fetchReports = () => wait(reports);
export async function setReportStatus(id: string): Promise<void> {
  reports = reports.filter((r) => r.id !== id);
  await wait(0);
}
export const fetchRecentRatings = () => wait(ratings);
export async function setRatingStatus(id: string, status: AdminRating["status"]): Promise<void> {
  ratings = ratings.map((r) => (r.id === id ? { ...r, status } : r));
  await wait(0);
}
export async function setRaterStatus(userId: string, status: AdminRating["status"]): Promise<number> {
  ratings = ratings.map((r) => (r.user_id === userId ? { ...r, status } : r));
  return wait(ratings.filter((r) => r.user_id === userId).length);
}
export const fetchRecentReviews = () => wait(reviews);
export async function setReviewStatus(id: string, status: AdminReview["status"]): Promise<void> {
  reviews = reviews.map((r) => (r.id === id ? { ...r, status } : r));
  await wait(0);
}
export const fetchAllSpots = () => wait(spots);
export async function deleteSpot(id: string): Promise<void> {
  const gone = spots.find((s) => s.id === id);
  spots = spots.filter((s) => s.id !== id);
  if (gone) deleted = [{ id: deleted.length + 2, spot_id: gone.id, name: gone.name, city: gone.city, rating_count: gone.rating_count, deleted_at: ago(0) }, ...deleted];
  await wait(0);
}
export const fetchDeletedSpots = () => wait(deleted);
export async function restoreSpot(archiveId: number): Promise<void> {
  deleted = deleted.filter((d) => d.id !== archiveId);
  await wait(0);
}
