import { ORPCError } from "@orpc/server";
import { db } from "@sms/db";
import {
	campus,
	department,
	section,
	studentProfile,
	userAccess,
} from "@sms/db/schema/hierarchy";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../lib/orpc";

export const studentRouter = {
	getDashboard: protectedProcedure
		.input(z.object({ institutionId: z.string() }))
		.handler(async ({ input, context }) => {
			const { institutionId } = input;
			const userId = context.session.user.id;

			const [access] = await db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.institutionId, institutionId),
						eq(userAccess.userId, userId),
						eq(userAccess.role, "student"),
					),
				)
				.limit(1);

			if (!access) {
				throw new ORPCError("FORBIDDEN", { message: "Not a student" });
			}

			const [profile] = await db
				.select()
				.from(studentProfile)
				.where(eq(studentProfile.userId, userId))
				.limit(1);

			const [branchCampus] = await db
				.select()
				.from(campus)
				.where(eq(campus.id, access.campusId))
				.limit(1);

			const [dept] = access.departmentId
				? await db
						.select()
						.from(department)
						.where(eq(department.id, access.departmentId))
						.limit(1)
				: [null];

			const [sec] = access.sectionId
				? await db
						.select()
						.from(section)
						.where(eq(section.id, access.sectionId))
						.limit(1)
				: [null];

			return {
				role: "student",
				profile,
				branch: branchCampus,
				department: dept,
				section: sec,
			};
		}),
};
