import { db } from "@sms/db";
import { institution } from "@sms/db/schema/auth";
import { desc, eq } from "drizzle-orm";

async function main() {
	try {
		const insts = await db
			.select()
			.from(institution)
			.orderBy(desc(institution.createdAt))
			.limit(1);
		if (insts.length > 0) {
			const inst = insts[0];
			console.log(
				`Updating institution: ${inst.name} (${inst.id}) to Standard plan`,
			);
			await db
				.update(institution)
				.set({ plan: "Standard" })
				.where(eq(institution.id, inst.id));
			console.log("Plan updated successfully!");
		} else {
			console.log("No institution found.");
		}
	} catch (e) {
		console.error(e);
	}
	process.exit(0);
}

main();
