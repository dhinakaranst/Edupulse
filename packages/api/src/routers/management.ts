import crypto from "node:crypto";
import { ORPCError } from "@orpc/server";
import { auth } from "@sms/auth";
import { db } from "@sms/db";
import { member, user } from "@sms/db/schema/auth";
import {
	campus,
	department,
	section,
	studentProfile,
	userAccess,
} from "@sms/db/schema/hierarchy";
import { env } from "@sms/env/server";
import { and, eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import { z } from "zod";
import { protectedProcedure } from "../lib/orpc";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
});

export const managementRouter = {
	getBranchDashboardStats: protectedProcedure
		.input(
			z.object({
				branchId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { branchId } = input;
			const userId = context.session.user.id;

			// 1. Check branch-level userAccess (for principals, advisors, teachers, etc.)
			const [access] = await db
				.select()
				.from(userAccess)
				.where(
					and(eq(userAccess.campusId, branchId), eq(userAccess.userId, userId)),
				)
				.limit(1);

			// 2. If no branch-level row, check if user is institution owner/admin.
			//    Owners who registered the institution never get a userAccess row —
			//    their role lives in the Better Auth `member` table at org level.
			let isInstitutionOwner = false;
			if (!access) {
				const [branchCampus] = await db
					.select({ institutionId: campus.institutionId })
					.from(campus)
					.where(eq(campus.id, branchId))
					.limit(1);

				if (branchCampus) {
					const [ownerMembership] = await db
						.select()
						.from(member)
						.where(
							and(
								eq(member.userId, userId),
								eq(member.organizationId, branchCampus.institutionId),
							),
						)
						.limit(1);

					if (
						ownerMembership &&
						["owner", "admin"].includes(ownerMembership.role)
					) {
						isInstitutionOwner = true;
					}
				}
			}

			// 3. Deny if neither branch-level access nor institution owner
			if (
				!access &&
				!isInstitutionOwner &&
				context.session.user.role !== "admin"
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "Access denied to this branch",
				});
			}

			// Owners get full principal-level access across all departments
			const userRole = access?.role || "principal";
			const targetDeptId = access?.departmentId;

			// 2. Fetch Branch Info
			const [branchInfo] = await db
				.select()
				.from(campus)
				.where(eq(campus.id, branchId))
				.limit(1);

			// 3. Fetch Departments
			let departmentsList: any[];
			if (
				userRole === "principal" ||
				isInstitutionOwner ||
				context.session.user.role === "admin"
			) {
				departmentsList = await db
					.select()
					.from(department)
					.where(eq(department.campusId, branchId));
			} else {
				departmentsList = await db
					.select()
					.from(department)
					.where(eq(department.id, targetDeptId as string));
			}

			// 4. Fetch Student Counts and attach Sections
			const deptIds = departmentsList.map((d) => d.id);
			
			const allSections = deptIds.length > 0 
				? await db.select().from(section).where(inArray(section.departmentId, deptIds))
				: [];

			const departmentsWithSections = departmentsList.map((dept) => ({
				...dept,
				sections: allSections.filter((s) => s.departmentId === dept.id),
			}));

			const students = await db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.campusId, branchId),
						eq(userAccess.role, "student"),
						deptIds.length > 0
							? inArray(userAccess.departmentId, deptIds)
							: undefined,
					),
				);

			return {
				branch: branchInfo,
				role: userRole,
				departments: departmentsWithSections,
				stats: {
					students: students.length,
					departments: departmentsList.length,
				},
			};
		}),

	getBranchStudents: protectedProcedure
		.input(z.object({ branchId: z.string() }))
		.handler(async ({ input, context }) => {
			const { branchId } = input;
			const userId = context.session.user.id;

			// 1. Authorization check
			const [access] = await db
				.select()
				.from(userAccess)
				.where(
					and(eq(userAccess.campusId, branchId), eq(userAccess.userId, userId)),
				)
				.limit(1);

			let isInstitutionOwner = false;
			if (!access) {
				const [branchCampus] = await db
					.select({ institutionId: campus.institutionId })
					.from(campus)
					.where(eq(campus.id, branchId))
					.limit(1);

				if (branchCampus) {
					const [ownerMembership] = await db
						.select()
						.from(member)
						.where(
							and(
								eq(member.userId, userId),
								eq(member.organizationId, branchCampus.institutionId),
							),
						)
						.limit(1);

					if (
						ownerMembership &&
						["owner", "admin"].includes(ownerMembership.role)
					) {
						isInstitutionOwner = true;
					}
				}
			}

			if (
				!access &&
				!isInstitutionOwner &&
				context.session.user.role !== "admin"
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "Access denied to this branch",
				});
			}

			// 2. Determine allowed departments
			const userRole = access?.role || "principal";
			const targetDeptId = access?.departmentId;

			let allowedDeptIds: string[] = [];
			if (
				userRole === "principal" ||
				isInstitutionOwner ||
				context.session.user.role === "admin"
			) {
				const departmentsList = await db
					.select({ id: department.id })
					.from(department)
					.where(eq(department.campusId, branchId));
				allowedDeptIds = departmentsList.map((d) => d.id);
			} else if (targetDeptId) {
				allowedDeptIds = [targetDeptId];
			}

			if (allowedDeptIds.length === 0) {
				return { students: [] }; // No departments to view
			}

			// 3. Fetch students with joined relations
			const studentRecords = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					role: userAccess.role,
					rollNumber: studentProfile.rollNumber,
					departmentName: department.name,
					sectionName: section.name,
				})
				.from(userAccess)
				.innerJoin(user, eq(userAccess.userId, user.id))
				.leftJoin(studentProfile, eq(studentProfile.userId, user.id))
				.leftJoin(department, eq(userAccess.departmentId, department.id))
				.leftJoin(section, eq(userAccess.sectionId, section.id))
				.where(
					and(
						eq(userAccess.campusId, branchId),
						eq(userAccess.role, "student"),
						inArray(userAccess.departmentId, allowedDeptIds),
					),
				);

			return { students: studentRecords };
		}),

	createDepartment: protectedProcedure
		.input(
			z.object({
				branchId: z.string(),
				name: z.string().min(1),
			}),
		)
		.handler(async ({ input }) => {
			const id = crypto.randomUUID();
			await db.insert(department).values({
				id,
				campusId: input.branchId,
				name: input.name,
			});
			return { id };
		}),

	createSection: protectedProcedure
		.input(
			z.object({
				departmentId: z.string(),
				name: z.string().min(1),
			}),
		)
		.handler(async ({ input }) => {
			const id = crypto.randomUUID();
			await db.insert(section).values({
				id,
				departmentId: input.departmentId,
				name: input.name,
			});
			return { id };
		}),

	bulkImportStudents: protectedProcedure
		.input(
			z.object({
				branchId: z.string(),
				departmentId: z.string().optional(),
				students: z.array(
					z.object({
						name: z.string(),
						email: z.string(),
						rollNumber: z.string(),
						sectionName: z.string().optional(),
					}),
				),
			}),
		)
		.handler(async ({ input, context }) => {
			const { branchId, departmentId, students } = input;
			const results = { added: 0, skipped: 0 };

			for (const s of students) {
				const tempPassword = Math.random().toString(36).slice(-10);

				try {
					// Create Account
					const res = await auth.api.signUpEmail({
						body: { email: s.email, password: tempPassword, name: s.name },
					});

					const userId = res.user.id;

					// Link to Institution
					const [orgMember] = await db
						.select()
						.from(member)
						.where(eq(member.userId, context.session.user.id))
						.limit(1);
					if (orgMember) {
						await db.insert(member).values({
							id: crypto.randomUUID(),
							userId,
							organizationId: orgMember.organizationId,
							role: "member",
						});

						// Create Student Profile & Access
						await db.insert(userAccess).values({
							id: crypto.randomUUID(),
							userId,
							institutionId: orgMember.organizationId,
							campusId: branchId,
							departmentId: departmentId,
							role: "student",
						});

						await db.insert(studentProfile).values({
							id: crypto.randomUUID(),
							userId,
							rollNumber: s.rollNumber,
						});

						// Send Mail
						await transporter.sendMail({
							from: env.EMAIL_USER,
							to: s.email,
							subject: "Welcome to EduPulse - Student Portal",
							html: `<p>Your account is ready. Login with ${s.email} and password: ${tempPassword}</p>`,
						});

						results.added++;
					}
				} catch (_e) {
					results.skipped++;
				}
			}

			return results;
		}),

	downloadBranchStudentTemplate: protectedProcedure
		.input(z.object({ branchId: z.string() }))
		.handler(async ({ input }) => {
			const { branchId } = input;

			const [branchInfo] = await db
				.select()
				.from(campus)
				.where(eq(campus.id, branchId))
				.limit(1);
			if (!branchInfo)
				throw new ORPCError("NOT_FOUND", { message: "Branch not found" });

			const departments = await db
				.select()
				.from(department)
				.where(eq(department.campusId, branchId));
			const deptIds = departments.map((d) => d.id);
			const sections =
				deptIds.length > 0
					? await db
						.select()
						.from(section)
						.where(inArray(section.departmentId, deptIds))
					: [];

			const workbook = new ExcelJS.Workbook();

			// Sheet 1: "students" — where the user fills data
			const studentsSheet = workbook.addWorksheet("students");
			studentsSheet.columns = [
				{ header: "name", key: "name", width: 30 },
				{ header: "email", key: "email", width: 35 },
				{ header: "department", key: "department", width: 30 },
				{ header: "section", key: "section", width: 25 },
				{ header: "roll_number", key: "roll_number", width: 20 },
			];
			studentsSheet.getRow(1).font = { bold: true };

			// Example row so user knows the format
			const exDept = departments[0];
			const exSection = exDept
				? sections.find((s) => s.departmentId === exDept.id)
				: undefined;
			studentsSheet.addRow({
				name: "John Doe",
				email: "john.doe@example.com",
				department: exDept?.name ?? "Computer Science",
				section: exSection?.name ?? "Section A",
				roll_number: "STU001",
			});

			// Sheet 2: "reference" — valid dept/section combos for the user to look up
			const refSheet = workbook.addWorksheet("reference");
			refSheet.columns = [
				{ header: "department", key: "dept", width: 30 },
				{ header: "section", key: "sec", width: 30 },
			];
			refSheet.getRow(1).font = { bold: true };

			for (const dept of departments) {
				const deptSections = sections.filter((s) => s.departmentId === dept.id);
				if (deptSections.length === 0) {
					refSheet.addRow({ dept: dept.name, sec: "" });
				} else {
					for (const sec of deptSections) {
						refSheet.addRow({ dept: dept.name, sec: sec.name });
					}
				}
			}

			const buffer = await workbook.xlsx.writeBuffer();
			const safeName = branchInfo.name.replace(/\s+/g, "_");

			return new Response(buffer as ArrayBuffer, {
				headers: {
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"Content-Disposition": `attachment; filename="${safeName}_students_template.xlsx"`,
				},
			});
		}),

	uploadBranchStudents: protectedProcedure
		.input(
			z.object({
				branchId: z.string(),
				file: z.instanceof(File),
			}),
		)
		.handler(async ({ input, context }) => {
			const { branchId, file } = input;
			const results = { added: 0, skipped: 0, errors: [] as string[] };

			// Parse the Excel file
			const buffer = await file.arrayBuffer();
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(buffer);

			const studentsSheet = workbook.getWorksheet("students");
			if (!studentsSheet)
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid template: 'students' sheet not found",
				});

			const [branchInfo] = await db
				.select()
				.from(campus)
				.where(eq(campus.id, branchId))
				.limit(1);
			if (!branchInfo)
				throw new ORPCError("NOT_FOUND", { message: "Branch not found" });

			// Resolve institution from uploader's membership
			const [userMember] = await db
				.select()
				.from(member)
				.where(eq(member.userId, context.session.user.id))
				.limit(1);
			if (!userMember)
				throw new ORPCError("FORBIDDEN", {
					message: "You are not part of any institution",
				});

			const institutionId = userMember.organizationId;

			// Build dept + section lookups
			const departments = await db
				.select()
				.from(department)
				.where(eq(department.campusId, branchId));
			const deptMap = new Map(
				departments.map((d) => [d.name.toLowerCase().trim(), d.id]),
			);

			const deptIds = departments.map((d) => d.id);
			const sections =
				deptIds.length > 0
					? await db
						.select()
						.from(section)
						.where(inArray(section.departmentId, deptIds))
					: [];
			const sectionMap = new Map(
				sections.map((s) => [
					`${s.departmentId}-${s.name.toLowerCase().trim()}`,
					s.id,
				]),
			);

			const getVal = (cell: ExcelJS.Cell): string => {
				const v = cell.value;
				if (!v) return "";
				if (typeof v === "object") {

					if ("text" in v) return v.text?.toString().trim() ?? "";

					if ("result" in v) return v.result?.toString().trim() ?? "";
				}
				return v.toString().trim();
			};

			// Parse rows (skip header row and the example row)
			const rows: {
				name: string;
				email: string;
				dept: string;
				section: string;
				rollNumber: string;
			}[] = [];
			studentsSheet.eachRow((row, rowNumber) => {
				if (rowNumber === 1) return;
				const name = getVal(row.getCell(1));
				const email = getVal(row.getCell(2));
				if (!name || !email) return;
				rows.push({
					name,
					email: email.toLowerCase(),
					dept: getVal(row.getCell(3)),
					section: getVal(row.getCell(4)),
					rollNumber: getVal(row.getCell(5)),
				});
			});

			for (const p of rows) {
				try {
					const deptId = p.dept ? deptMap.get(p.dept.toLowerCase()) : undefined;
					const sKey =
						deptId && p.section ? `${deptId}-${p.section.toLowerCase()}` : null;
					const sId = sKey ? sectionMap.get(sKey) : undefined;

					const tempPassword = Math.random().toString(36).slice(-10);

					// 1. Find or create user account
					let isNewUser = false;
					let currentUser: { id: string };

					const [existingUser] = await db
						.select()
						.from(user)
						.where(eq(user.email, p.email))
						.limit(1);

					if (existingUser) {
						currentUser = existingUser;
					} else {
						// Better Auth throws "User already exists" if the user was just created
						try {
							const res = await auth.api.signUpEmail({
								body: {
									email: p.email,
									password: tempPassword,
									name: p.name,
								} as Record<string, unknown> as Parameters<typeof auth.api.signUpEmail>[0]["body"],
							});
							currentUser = res.user;
							isNewUser = true;
							await db
								.update(user)
								.set({ hasChangedPassword: false })
								.where(eq(user.id, currentUser.id));
						} catch (signUpErr) {
							// Check DB one more time just in case of race condition / duplicate in same sheet
							const [retryUser] = await db
								.select()
								.from(user)
								.where(eq(user.email, p.email))
								.limit(1);

							if (retryUser) {
								currentUser = retryUser;
							} else {
								throw signUpErr;
							}
						}
					}

					// 2. Ensure institution membership
					const [isMember] = await db
						.select()
						.from(member)
						.where(
							and(
								eq(member.userId, currentUser.id),
								eq(member.organizationId, institutionId),
							),
						)
						.limit(1);

					if (!isMember) {
						await db.insert(member).values({
							id: crypto.randomUUID(),
							userId: currentUser.id,
							organizationId: institutionId,
							role: "member",
						});
					}

					// 3. Create RBAC access (idempotent)
					const [existingAccess] = await db
						.select()
						.from(userAccess)
						.where(
							and(
								eq(userAccess.userId, currentUser.id),
								eq(userAccess.institutionId, institutionId),
								eq(userAccess.campusId, branchId),
							),
						)
						.limit(1);

					if (!existingAccess) {
						await db.insert(userAccess).values({
							id: crypto.randomUUID(),
							userId: currentUser.id,
							institutionId,
							campusId: branchId,
							departmentId: deptId ?? null,
							sectionId: sId ?? null,
							role: "student",
						});
					}

					// 4. Create student profile
					if (sId) {
						const [extProfile] = await db
							.select()
							.from(studentProfile)
							.where(eq(studentProfile.userId, currentUser.id))
							.limit(1);
						if (!extProfile) {
							await db.insert(studentProfile).values({
								id: crypto.randomUUID(),
								userId: currentUser.id,
								sectionId: sId,
								rollNumber:
									p.rollNumber ||
									`STU-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`,
							});
						}
					}

					// 5. Send welcome email for new accounts only
					if (isNewUser) {
						try {
							await transporter.sendMail({
								from: `"EduPulse Admin" <${env.EMAIL_USER}>`,
								to: p.email,
								subject: `Welcome to ${branchInfo.name} - Your Login Credentials`,
								html: `
									<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
										<h2 style="color: #4f46e5;">Welcome to EduPulse, ${p.name}!</h2>
										<p>An account has been created for you at <strong>${branchInfo.name}</strong>.</p>
										<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
											<p style="margin: 0;"><strong>Email:</strong> ${p.email}</p>
											<p style="margin: 5px 0 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 4px; border-radius: 4px;">${tempPassword}</code></p>
										</div>
										<p>Please log in and change your password immediately.</p>
										<a href="${env.CORS_ORIGIN.split(",")[0]}/sign-in" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Log In Now</a>
									</div>
								`,
							});
						} catch (mailErr) {
							const errMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
							console.error(
								`[API] Failed to send email to ${p.email}:`,
								errMsg,
							);
						}
					}

					console.log(`[API] Enrolled student: ${p.name} (${p.email})`);
					results.added++;
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : String(err);
					console.error(
						`[API] Failed to process student ${p.email}:`,
						errMsg,
					);
					results.errors.push(`${p.email}: ${errMsg}`);
					results.skipped++;
				}
			}

			return results;
		}),
};
