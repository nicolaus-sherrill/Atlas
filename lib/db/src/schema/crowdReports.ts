import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crowdReportsTable = pgTable("crowd_reports", {
  id: serial("id").primaryKey(),
  spotId: text("spot_id").notNull(),
  level: integer("level").notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  dayOfWeek: integer("day_of_week").notNull(),
  hourOfDay: integer("hour_of_day").notNull(),
});

export const insertCrowdReportSchema = createInsertSchema(crowdReportsTable).omit({ id: true, reportedAt: true, dayOfWeek: true, hourOfDay: true });
export type InsertCrowdReport = z.infer<typeof insertCrowdReportSchema>;
export type CrowdReport = typeof crowdReportsTable.$inferSelect;
