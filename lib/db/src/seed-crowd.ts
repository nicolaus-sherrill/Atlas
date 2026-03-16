import { db, crowdReportsTable } from "./index";
import { sql } from "drizzle-orm";

const SPOT_IDS = Array.from({ length: 13 }, (_, i) => `seed-${i + 1}`);

const SPOT_PROFILES: Record<string, { peakHours: number[]; baseLevel: number; peakLevel: number }> = {
  "seed-1": { peakHours: [8, 9, 10, 12, 13], baseLevel: 1, peakLevel: 3 },
  "seed-2": { peakHours: [9, 10, 11, 14, 15, 16], baseLevel: 1, peakLevel: 4 },
  "seed-3": { peakHours: [8, 9, 10, 11], baseLevel: 1, peakLevel: 3 },
  "seed-4": { peakHours: [7, 8, 9, 12, 13], baseLevel: 1, peakLevel: 3 },
  "seed-5": { peakHours: [10, 11, 12, 17, 18, 19], baseLevel: 1, peakLevel: 4 },
  "seed-6": { peakHours: [8, 9, 10, 14, 15], baseLevel: 1, peakLevel: 2 },
  "seed-7": { peakHours: [10, 11, 14, 15, 16], baseLevel: 1, peakLevel: 2 },
  "seed-8": { peakHours: [10, 11, 12, 13, 14, 15], baseLevel: 2, peakLevel: 4 },
  "seed-9": { peakHours: [8, 9, 11, 12], baseLevel: 1, peakLevel: 3 },
  "seed-10": { peakHours: [18, 19, 20, 21, 22], baseLevel: 1, peakLevel: 3 },
  "seed-11": { peakHours: [8, 9, 10, 13, 14], baseLevel: 1, peakLevel: 3 },
  "seed-12": { peakHours: [7, 8, 9, 10, 11], baseLevel: 1, peakLevel: 3 },
  "seed-13": { peakHours: [9, 10, 11, 14, 15], baseLevel: 1, peakLevel: 2 },
};

function getLevel(spotId: string, hour: number, dayOfWeek: number): number {
  const profile = SPOT_PROFILES[spotId] || { peakHours: [10, 11, 12], baseLevel: 1, peakLevel: 3 };
  const isPeak = profile.peakHours.includes(hour);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let level = isPeak ? profile.peakLevel : profile.baseLevel;

  if (isWeekend && isPeak) {
    level = Math.min(4, level + 1);
  }

  const jitter = Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0;
  level = Math.max(1, Math.min(4, level + jitter));

  return level;
}

async function seed() {
  console.log("Seeding crowd reports...");

  await db.delete(crowdReportsTable).where(sql`1=1`);

  const reports: {
    spotId: string;
    level: number;
    reportedAt: Date;
    dayOfWeek: number;
    hourOfDay: number;
  }[] = [];

  const now = new Date();

  for (const spotId of SPOT_IDS) {
    for (let daysAgo = 0; daysAgo < 28; daysAgo++) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      const dayOfWeek = date.getDay();

      const hoursToReport = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

      for (const hour of hoursToReport) {
        const reportsPerHour = Math.floor(Math.random() * 3) + 1;
        for (let r = 0; r < reportsPerHour; r++) {
          const reportDate = new Date(date);
          reportDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

          reports.push({
            spotId,
            level: getLevel(spotId, hour, dayOfWeek),
            reportedAt: reportDate,
            dayOfWeek,
            hourOfDay: hour,
          });
        }
      }
    }
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = reports.slice(i, i + BATCH_SIZE);
    await db.insert(crowdReportsTable).values(batch);
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, reports.length)}/${reports.length} reports`);
  }

  console.log(`Seeded ${reports.length} crowd reports for ${SPOT_IDS.length} spots.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
