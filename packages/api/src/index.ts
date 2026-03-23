export { o, protectedProcedure, publicProcedure } from "./lib/orpc";

import { RPCHandler } from "@orpc/server/fetch";
import { auth } from "@sms/auth";
import { db } from "@sms/db";
import { campus, department, section } from "@sms/db/schema/hierarchy";
import { eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { Hono } from "hono";
import { createContext } from "./context";
import { appRouter } from "./routers";

// 2. oRPC Handler for Hono RPC Integration
const rpcHandler = new RPCHandler(appRouter);

/**
 * The business API Router
 * We use Hono here to combine and expose the oRPC logic
 */
export const api = new Hono()
	.get("/onboarding/template/download", async (c) => {
		console.log(
			`[API] Download Request for institutionId: ${c.req.query("institutionId")}`,
		);
		const institutionId = c.req.query("institutionId");
		if (!institutionId) {
			console.warn("[API] Missing institutionId in download request");
			return c.json({ error: "Missing institutionId" }, 400);
		}

		// Session Check
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		console.log(`[API] Session check result: ${session ? "valid" : "missing"}`);

		if (!session) {
			console.warn("[API] Download attempt by unauthorized user");
			return c.json({ error: "Unauthorized" }, 401);
		}

		console.log("[API] Generating Excel workbook...");
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

		console.log("[API] Excel generation complete. Sending response...");
		return new Response(buffer as Buffer, {
			headers: {
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": 'attachment; filename="edupulse-template.xlsx"',
			},
		});
	})
	.get("/students/template/download", async (c) => {
		const branchId = c.req.query("branchId");
		if (!branchId) {
			return c.json({ error: "Missing branchId" }, 400);
		}

		// Session check
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		// Fetch branch info
		const [branchInfo] = await db
			.select()
			.from(campus)
			.where(eq(campus.id, branchId))
			.limit(1);
		if (!branchInfo) {
			return c.json({ error: "Branch not found" }, 404);
		}

		// Fetch departments + sections for this branch only
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

		// Sheet 1: students — input sheet
		const studentsSheet = workbook.addWorksheet("students");
		studentsSheet.columns = [
			{ header: "name", key: "name", width: 30 },
			{ header: "email", key: "email", width: 35 },
			{ header: "department", key: "department", width: 30 },
			{ header: "section", key: "section", width: 25 },
			{ header: "roll_number", key: "roll_number", width: 20 },
		];
		studentsSheet.getRow(1).font = { bold: true };

		// Example row
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

		// Sheet 2: reference — valid dept/section combos
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

		console.log(
			`[API] Student template generated for branch: ${branchInfo.name} (${departments.length} depts, ${sections.length} sections)`,
		);

		return new Response(buffer as ArrayBuffer, {
			headers: {
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": `attachment; filename="${safeName}_students_template.xlsx"`,
			},
		});
	})
	.all("/rpc/*", async (c) => {
		console.log(`[API] oRPC Request: ${c.req.method} ${c.req.url}`);
		const context = await createContext({ context: c });
		const result = await rpcHandler.handle(c.req.raw, {
			prefix: "/api/rpc",
			context,
		});

		if (result.matched) {
			console.log(`[API] oRPC Matched! Status: ${result.response.status}`);
			return result.response;
		}

		console.warn(`[API] oRPC Not matched for: ${c.req.url}`);
		return c.json({ error: "Not Matched" }, 404);
	});

// Export Type for Frontend Client
export type AppType = typeof api;
