import { ORPCError } from "@orpc/server";
import { db } from "@sms/db";
import { attendance } from "@sms/db/schema/attendance";
import { user } from "@sms/db/schema/auth";
import { studentProfile, userAccess } from "@sms/db/schema/hierarchy";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../lib/orpc";

export const attendanceRouter = {
	getSectionRoster: protectedProcedure
		.input(
			z.object({
				sectionId: z.string(),
				date: z.string(), // YYYY-MM-DD
			}),
		)
		.handler(async ({ input, context }) => {
			const { sectionId, date } = input;
			const userId = context.session.user.id;

			// Quick authorization logic: Only allow staff/principals to view
			const [access] = await db
				.select()
				.from(userAccess)
				.where(eq(userAccess.userId, userId))
				.limit(1);

			if (!access || access.role === "student" || access.role === "parent") {
				throw new ORPCError("FORBIDDEN", {
					message: "Only staff can manage attendance.",
				});
			}

			// Get all students for this section directly
			const students = await db
				.select({
					id: user.id,
					name: user.name,
					rollNumber: studentProfile.rollNumber,
				})
				.from(userAccess)
				.innerJoin(user, eq(userAccess.userId, user.id))
				.leftJoin(studentProfile, eq(studentProfile.userId, user.id))
				.where(
					and(
						eq(userAccess.sectionId, sectionId),
						eq(userAccess.role, "student"),
					),
				);

			// Find existing attendance records for the selected date
			const existingRecords = await db
				.select()
				.from(attendance)
				.where(
					and(eq(attendance.sectionId, sectionId), eq(attendance.date, date)),
				);

			const existingMap = new Map(
				existingRecords.map((r) => [r.studentId, r.status]),
			);

			// Merge roster with attendance format
			return students.map((s) => ({
				...s,
				status: existingMap.get(s.id) || "not_marked",
			}));
		}),

	submitAttendance: protectedProcedure
		.input(
			z.object({
				sectionId: z.string(),
				date: z.string(),
				records: z.array(
					z.object({
						studentId: z.string(),
						status: z.enum(["present", "absent", "late", "excused"]),
					}),
				),
			}),
		)
		.handler(async ({ input, context }) => {
			const { sectionId, date, records } = input;
			const userId = context.session.user.id;

			// Delete existing records for this section + date to rewrite them completely
			await db
				.delete(attendance)
				.where(
					and(eq(attendance.sectionId, sectionId), eq(attendance.date, date)),
				);

			// Insert new attendance mapping
			const inserts = records.map((r) => ({
				studentId: r.studentId,
				sectionId: sectionId,
				date: date,
				status: r.status,
				markedBy: userId,
			}));

			if (inserts.length > 0) {
				await db.insert(attendance).values(inserts);
			}

			return { success: true, count: inserts.length };
		}),

	getStudentStats: protectedProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const totalRecords = await db
			.select()
			.from(attendance)
			.where(eq(attendance.studentId, userId));

		const presentCount = totalRecords.filter((r) => r.status === "present" || r.status === "late").length;
		const percentage = totalRecords.length > 0 
			? Math.round((presentCount / totalRecords.length) * 100) 
			: null;

		return {
			totalClasses: totalRecords.length,
			present: presentCount,
			percentage,
		};
	}),
};
