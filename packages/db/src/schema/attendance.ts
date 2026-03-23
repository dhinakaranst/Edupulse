import { date, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { section } from "./hierarchy";

export const attendance = pgTable("attendance", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	studentId: text("student_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	sectionId: text("section_id")
		.notNull()
		.references(() => section.id, { onDelete: "cascade" }),
	date: date("date", { mode: "string" }).notNull(),
	status: text("status").notNull(), // "present", "absent", "late", "excused"
	markedBy: text("marked_by").references(() => user.id),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
