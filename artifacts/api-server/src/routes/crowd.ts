import { Router, type IRouter } from "express";
import { db, crowdReportsTable } from "@workspace/db";
import { eq, gte, sql, and } from "drizzle-orm";

const router: IRouter = Router();

const BUSYNESS_LABELS: Record<number, string> = {
  1: "Not busy",
  2: "A little busy",
  3: "Busy",
  4: "Very busy",
};

router.post("/crowd-report", async (req, res) => {
  try {
    const { spotId, level } = req.body;

    if (!spotId || typeof spotId !== "string") {
      res.status(400).json({ error: "spotId is required" });
      return;
    }
    if (!level || typeof level !== "number" || level < 1 || level > 4) {
      res.status(400).json({ error: "level must be 1-4" });
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    const [report] = await db
      .insert(crowdReportsTable)
      .values({
        spotId,
        level,
        reportedAt: now,
        dayOfWeek,
        hourOfDay,
      })
      .returning();

    res.json({ success: true, report });
  } catch (err) {
    console.error("Error submitting crowd report:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/crowd-status/:spotId", async (req, res) => {
  try {
    const { spotId } = req.params;
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const liveReports = await db
      .select()
      .from(crowdReportsTable)
      .where(
        and(
          eq(crowdReportsTable.spotId, spotId),
          gte(crowdReportsTable.reportedAt, threeHoursAgo)
        )
      )
      .orderBy(sql`${crowdReportsTable.reportedAt} DESC`);

    let currentLevel: number | null = null;
    let lastReportedAt: string | null = null;
    if (liveReports.length > 0) {
      const sum = liveReports.reduce((a, r) => a + r.level, 0);
      currentLevel = Math.round(sum / liveReports.length);
      lastReportedAt = liveReports[0].reportedAt.toISOString();
    }

    const hourlyAverages = await db
      .select({
        dayOfWeek: crowdReportsTable.dayOfWeek,
        hourOfDay: crowdReportsTable.hourOfDay,
        avgLevel: sql<number>`ROUND(AVG(${crowdReportsTable.level})::numeric, 1)`.as("avg_level"),
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(crowdReportsTable)
      .where(eq(crowdReportsTable.spotId, spotId))
      .groupBy(crowdReportsTable.dayOfWeek, crowdReportsTable.hourOfDay)
      .orderBy(crowdReportsTable.dayOfWeek, crowdReportsTable.hourOfDay);

    res.json({
      spotId,
      current: currentLevel
        ? {
            level: currentLevel,
            label: BUSYNESS_LABELS[currentLevel],
            lastReportedAt,
            reportCount: liveReports.length,
          }
        : null,
      hourlyAverages: hourlyAverages.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        hourOfDay: h.hourOfDay,
        avgLevel: Number(h.avgLevel),
        count: Number(h.count),
      })),
    });
  } catch (err) {
    console.error("Error fetching crowd status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/crowd-status", async (_req, res) => {
  try {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const liveReports = await db
      .select({
        spotId: crowdReportsTable.spotId,
        avgLevel: sql<number>`ROUND(AVG(${crowdReportsTable.level})::numeric, 0)`.as("avg_level"),
        lastReportedAt: sql<string>`MAX(${crowdReportsTable.reportedAt})`.as("last_reported_at"),
        reportCount: sql<number>`COUNT(*)`.as("report_count"),
      })
      .from(crowdReportsTable)
      .where(gte(crowdReportsTable.reportedAt, threeHoursAgo))
      .groupBy(crowdReportsTable.spotId);

    const statusMap: Record<
      string,
      { level: number; label: string; lastReportedAt: string; reportCount: number }
    > = {};

    for (const row of liveReports) {
      const level = Number(row.avgLevel);
      statusMap[row.spotId] = {
        level,
        label: BUSYNESS_LABELS[level] || "Unknown",
        lastReportedAt: row.lastReportedAt,
        reportCount: Number(row.reportCount),
      };
    }

    res.json({ statuses: statusMap });
  } catch (err) {
    console.error("Error fetching batch crowd status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
