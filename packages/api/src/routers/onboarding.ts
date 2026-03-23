import crypto from "node:crypto";
import { ORPCError } from "@orpc/server";
import { auth } from "@sms/auth";
import { db } from "@sms/db";
import { institution, member, team, user } from "@sms/db/schema/auth";
import {
	campus,
	department,
	section,
	studentProfile,
	userAccess,
} from "@sms/db/schema/hierarchy";
import { env } from "@sms/env/server";
import { and, eq, notInArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import { z } from "zod";
import { protectedProcedure } from "../lib/orpc";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: env.EMAIL_USER,
		pass: env.EMAIL_PASSWORD,
	},
});

export const onboardingRouter = {
	completePasswordChange: protectedProcedure.handler(async ({ context }) => {
		await db
			.update(user)
			.set({ hasChangedPassword: true })
			.where(eq(user.id, context.session.user.id));

		return { success: true };
	}),

	createCampuses: protectedProcedure
		.input(
			z.object({
				institutionId: z.string(),
				branches: z.array(
					z.object({
						name: z.string(),
						type: z.string(),
					}),
				),
			}),
		)
		.handler(async ({ input }) => {
			const branchInserts = input.branches.map((branch) => ({
				institutionId: input.institutionId,
				name: branch.name,
				type: branch.type,
			}));

			await db.insert(campus).values(branchInserts);

			return { success: true };
		}),

	getDashboard: protectedProcedure
		.input(
			z.object({
				institutionId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			console.log(
				"[API] getDashboard handler started for institutionId:",
				input.institutionId,
			);
			const { institutionId } = input;
			const userId = context.session.user.id;

			const [inst] = await db
				.select()
				.from(institution)
				.where(eq(institution.id, institutionId))
				.limit(1);
			if (!inst) {
				console.error("[API] Institution not found:", institutionId);
				throw new ORPCError("NOT_FOUND", { message: "Institution not found" });
			}

			const [access] = await db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.institutionId, institutionId),
						eq(userAccess.userId, userId),
					),
				)
				.limit(1);

			const role = access?.role || "owner";
			const scopedCampusId = access?.campusId;
			const scopedDeptId = access?.departmentId;

			let campusesQuery = db
				.select()
				.from(campus)
				.where(eq(campus.institutionId, institutionId));
			if (scopedCampusId) {
				campusesQuery = db
					.select()
					.from(campus)
					.where(
						and(
							eq(campus.institutionId, institutionId),
							eq(campus.id, scopedCampusId),
						),
					);
			}
			const campusesList = await campusesQuery;

			let staffBaseQuery = db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.institutionId, institutionId),
						notInArray(userAccess.role, ["student", "parent"]),
					),
				);
			let studentBaseQuery = db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.institutionId, institutionId),
						eq(userAccess.role, "student"),
					),
				);

			if (scopedCampusId) {
				staffBaseQuery = db
					.select()
					.from(userAccess)
					.where(
						and(
							eq(userAccess.institutionId, institutionId),
							eq(userAccess.campusId, scopedCampusId),
							notInArray(userAccess.role, ["student", "parent"]),
						),
					);
				studentBaseQuery = db
					.select()
					.from(userAccess)
					.where(
						and(
							eq(userAccess.institutionId, institutionId),
							eq(userAccess.campusId, scopedCampusId),
							eq(userAccess.role, "student"),
						),
					);
			}

			if (scopedCampusId && scopedDeptId) {
				staffBaseQuery = db
					.select()
					.from(userAccess)
					.where(
						and(
							eq(userAccess.institutionId, institutionId),
							eq(userAccess.campusId, scopedCampusId),
							eq(userAccess.departmentId, scopedDeptId),
							notInArray(userAccess.role, ["student", "parent"]),
						),
					);
				studentBaseQuery = db
					.select()
					.from(userAccess)
					.where(
						and(
							eq(userAccess.institutionId, institutionId),
							eq(userAccess.campusId, scopedCampusId),
							eq(userAccess.departmentId, scopedDeptId),
							eq(userAccess.role, "student"),
						),
					);
			}

			const staffAccess = await staffBaseQuery;
			const studentAccess = await studentBaseQuery;

			const campusDetails = await Promise.all(
				campusesList.map(async (camp) => {
					const depts = await db
						.select()
						.from(department)
						.where(eq(department.campusId, camp.id));
					const staffCount = staffAccess.filter(
						(a) => a.campusId === camp.id,
					).length;

					return {
						...camp,
						deptCount: depts.length,
						staffCount: staffCount,
					};
				}),
			);

			const result = {
				institution: {
					id: institutionId,
					name: inst.name,
					plan: inst.plan || "Free",
					status: inst.status || "Pending",
					role: role,
				},
				stats: {
					branches: campusesList.length,
					staff: staffAccess.length,
					students: studentAccess.length,
				},
				campuses: campusDetails,
			};
			console.log("[API] getDashboard handler successfully returning data");
			return result;
		}),

	getMembers: protectedProcedure
		.input(
			z.object({
				institutionId: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			const membersList = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					role: userAccess.role,
					campus: campus.name,
					department: department.name,
					section: section.name,
				})
				.from(userAccess)
				.innerJoin(user, eq(userAccess.userId, user.id))
				.leftJoin(campus, eq(userAccess.campusId, campus.id))
				.leftJoin(department, eq(userAccess.departmentId, department.id))
				.leftJoin(section, eq(userAccess.sectionId, section.id))
				.where(eq(userAccess.institutionId, input.institutionId));

			return { members: membersList };
		}),

	getBranch: protectedProcedure
		.input(
			z.object({
				branchId: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			const [branchData] = await db
				.select()
				.from(campus)
				.where(eq(campus.id, input.branchId))
				.limit(1);

			if (!branchData)
				throw new ORPCError("NOT_FOUND", { message: "Branch not found" });

			const depts = await db
				.select()
				.from(department)
				.where(eq(department.campusId, input.branchId));

			const staffCount = await db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.campusId, input.branchId),
						notInArray(userAccess.role, ["student", "parent"]),
					),
				);

			const studentCount = await db
				.select()
				.from(userAccess)
				.where(
					and(
						eq(userAccess.campusId, input.branchId),
						eq(userAccess.role, "student"),
					),
				);

			return {
				branch: branchData,
				departments: depts,
				stats: {
					staff: staffCount.length,
					students: studentCount.length,
					departments: depts.length,
				},
			};
		}),

	downloadTemplate: protectedProcedure
		.input(
			z.object({
				institutionId: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			const { institutionId } = input;
			const campusesList = await db
				.select()
				.from(campus)
				.where(eq(campus.institutionId, institutionId));

			const workbook = new ExcelJS.Workbook();
			const structureSheet = workbook.addWorksheet("structure");
			structureSheet.columns = [
				{ header: "branch_name", key: "branch_name", width: 25 },
				{ header: "branch_type", key: "branch_type", width: 20 },
				{ header: "department", key: "department", width: 30 },
				{ header: "section", key: "section", width: 25 },
			];
			structureSheet.getRow(1).font = { bold: true };

			if (campusesList.length > 0) {
				campusesList.forEach((camp) => {
					structureSheet.addRow({
						branch_name: camp.name,
						branch_type: camp.type,
						department: "Example Dept",
						section: "Example Section",
					});
				});
			} else {
				structureSheet.addRow({
					branch_name: "Example Campus",
					branch_type: "engineering",
					department: "Computer Science",
					section: "CS 1st Year A",
				});
			}

			const peopleSheet = workbook.addWorksheet("people");
			peopleSheet.columns = [
				{ header: "name", key: "name", width: 25 },
				{ header: "email", key: "email", width: 30 },
				{ header: "phone", key: "phone", width: 20 },
				{ header: "branch", key: "branch", width: 25 },
				{ header: "department", key: "department", width: 30 },
				{ header: "section", key: "section", width: 25 },
				{ header: "role", key: "role", width: 20 },
			];
			peopleSheet.getRow(1).font = { bold: true };

			const buffer = await workbook.xlsx.writeBuffer();

			// Returning a response from oRPC handler works
			return new Response(buffer, {
				headers: {
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"Content-Disposition": 'attachment; filename="template.xlsx"',
				},
			});
		}),

	uploadTemplate: protectedProcedure
		.input(
			z.object({
				institutionId: z.string(),
				file: z.instanceof(File),
			}),
		)
		.handler(async ({ input }) => {
			const { institutionId, file } = input;
			const buffer = await file.arrayBuffer();
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(buffer);

			const structureSheet = workbook.getWorksheet("structure");
			if (!structureSheet)
				throw new ORPCError("BAD_REQUEST", { message: "Invalid template" });

			const campusesList = await db
				.select()
				.from(campus)
				.where(eq(campus.institutionId, institutionId));
			const campusMap = new Map(
				campusesList.map((c) => [c.name.toLowerCase().trim(), c.id]),
			);
			const existingDepts = await db.select().from(department);
			const deptMap = new Map(
				existingDepts.map((d) => [
					`${d.campusId}-${d.name.toLowerCase().trim()}`,
					d.id,
				]),
			);
			const existingSections = await db.select().from(section);
			const sectionMap = new Map(
				existingSections.map((s) => [
					`${s.departmentId}-${s.name.toLowerCase().trim()}`,
					s.id,
				]),
			);
			const existingTeams = await db
				.select()
				.from(team)
				.where(eq(team.organizationId, institutionId));
			const teamMap = new Map(
				existingTeams.map((t) => [t.name.toLowerCase().trim(), t.id]),
			);

			const getVal = (cell: ExcelJS.Cell) => {
				const v = cell.value;
				if (!v) return "";
				if (typeof v === "object") {
					
					if ("text" in v) return v.text?.toString().trim() || "";
					
					if ("result" in v) return v.result?.toString().trim() || "";
				}
				return v.toString().trim();
			};

			let dCount = 0;
			let sCount = 0;
			const uCount = 0;

			const structureRows: any[] = [];
			structureSheet.eachRow((row, rowNumber) => {
				if (rowNumber === 1) return;
				structureRows.push({
					branch: getVal(row.getCell(1)),
					dept: getVal(row.getCell(3)),
					section: getVal(row.getCell(4)),
				});
			});

			for (const r of structureRows) {
				const campusId = campusMap.get(r.branch.toLowerCase());
				if (!campusId) continue;
				let currentDeptId = null;
				if (r.dept) {
					const deptKey = `${campusId}-${r.dept.toLowerCase()}`;
					currentDeptId = deptMap.get(deptKey);
					if (!currentDeptId) {
						currentDeptId = crypto.randomUUID();
						await db
							.insert(department)
							.values({ id: currentDeptId, campusId, name: r.dept });
						deptMap.set(deptKey, currentDeptId);
						dCount++;
					}
					const teamKey = r.dept.toLowerCase().trim();
					if (!teamMap.has(teamKey)) {
						const tid = crypto.randomUUID();
						await db
							.insert(team)
							.values({ id: tid, name: r.dept, organizationId: institutionId });
						teamMap.set(teamKey, tid);
					}
				}
				if (currentDeptId && r.section) {
					const sKey = `${currentDeptId}-${r.section.toLowerCase()}`;
					if (!sectionMap.has(sKey)) {
						await db.insert(section).values({
							id: crypto.randomUUID(),
							departmentId: currentDeptId,
							name: r.section,
						});
						sectionMap.set(sKey, "exists");
						sCount++;
					}
				}
			}

			// People processing
			const peopleSheet = workbook.getWorksheet("people");
			if (peopleSheet) {
				const peopleRows: any[] = [];
				peopleSheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
					if (rowNumber === 1) return;
					const n = getVal(row.getCell(1));
					const e = getVal(row.getCell(2));
					if (n && e && n !== "Dr. Jane Doe") {
						peopleRows.push({
							name: n,
							email: e,
							phone: getVal(row.getCell(3)),
							branch: getVal(row.getCell(4)),
							dept: getVal(row.getCell(5)),
							section: getVal(row.getCell(6)),
							role: getVal(row.getCell(7)) || "member",
						});
					}
				});

				for (const p of peopleRows) {
					const campusId = campusMap.get(
						p.branch.toLowerCase().replace(/-/g, " ").trim(),
					);
					if (!campusId) {
						console.warn(
							`[API] Skipping user ${p.name} - Branch ${p.branch} not found`,
						);
						continue;
					}

					const tempPassword = Math.random().toString(36).slice(-10);
					let currentUser;

					// 1. Find or Create User + Account via auth service
					const [extUser] = await db
						.select()
						.from(user)
						.where(eq(user.email, p.email.toLowerCase().trim()))
						.limit(1);

					if (!extUser) {
						console.log(
							`[API] Creating account for new user: ${p.name} (${p.email})`,
						);
						try {
							const res = await auth.api.signUpEmail({
								body: {
									email: p.email.toLowerCase().trim(),
									password: tempPassword,
									name: p.name,
								},
							});
							currentUser = res.user;
							// Force password change on first login
							await db
								.update(user)
								.set({ hasChangedPassword: false })
								.where(eq(user.id, currentUser.id));
						} catch (err: any) {
							console.error(
								`[API] Failed to create user ${p.email}:`,
								err.message,
							);
							continue;
						}
					} else {
						currentUser = extUser;
					}

					// 2. Ensure Organization Membership
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

					// 3. Resolve Dept/Section
					const deptKey = p.dept
						? `${campusId}-${p.dept.toLowerCase().replace(/-/g, " ").trim()}`
						: null;
					const deptId = deptKey ? deptMap.get(deptKey) : null;

					const sectionKey =
						deptId && p.section
							? `${deptId}-${p.section.toLowerCase().trim()}`
							: null;
					const sId = sectionKey ? sectionMap.get(sectionKey) : null;

					// 4. Create User Access (RBAC) - Check for duplicates to allow re-uploads
					const [existingAccess] = await db
						.select()
						.from(userAccess)
						.where(
							and(
								eq(userAccess.userId, currentUser.id),
								eq(userAccess.institutionId, institutionId),
								eq(userAccess.campusId, campusId),
								p.role.toLowerCase() === "student"
									? eq(userAccess.sectionId, sId || "")
									: eq(userAccess.role, p.role.toLowerCase()),
							),
						)
						.limit(1);

					if (!existingAccess) {
						await db.insert(userAccess).values({
							id: crypto.randomUUID(),
							userId: currentUser.id,
							institutionId,
							campusId,
							departmentId: deptId,
							sectionId: sId,
							role: p.role.toLowerCase(),
						});
					}

					// 5. Create Student Profile if applicable
					if (p.role.toLowerCase() === "student" && sId) {
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
								rollNumber: `STU-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`,
							});
						}
					}

					// 6. Send Welcome Email if this was a new account or forced resend
					if (!extUser) {
						try {
							await transporter.sendMail({
								from: `"EduPulse Admin" <${env.EMAIL_USER}>`,
								to: p.email,
								subject: `Welcome to ${p.branch} - Your Login Credentials`,
								html: `
									<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
										<h2 style="color: #4f46e5;">Welcome to EduPulse, ${p.name}!</h2>
										<p>An account has been created for you at <strong>${p.branch}</strong>.</p>
										<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
											<p style="margin: 0;"><strong>Username:</strong> ${p.email}</p>
											<p style="margin: 5px 0 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 4px; border-radius: 4px;">${tempPassword}</code></p>
										</div>
										<p>Please log in and update your password immediately.</p>
										<a href="${env.CORS_ORIGIN.split(",")[0]}/sign-in" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Log In Now</a>
										<p style="font-size: 12px; color: #6b7280; margin-top: 30px;">If you didn't expect this email, please ignore it.</p>
									</div>
								`,
							});
							console.log(`[API] Welcome email sent to: ${p.email}`);
						} catch (mailErr: any) {
							console.error(
								`[API] Failed to send email to ${p.email}:`,
								mailErr.message,
							);
						}
					}

					console.log(`[API] Processed user: ${p.name} as ${p.role}`);
				}
			}

			await db
				.update(institution)
				.set({ status: "active" })
				.where(eq(institution.id, institutionId));

			return {
				success: true,
				message: `Processed ${dCount} depts, ${sCount} sections, ${uCount} members`,
			};
		}),
};
