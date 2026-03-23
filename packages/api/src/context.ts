import { auth } from "@sms/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	console.log(
		`[API] Creating context for ${context.req.method} ${context.req.url}`,
	);
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	console.log(
		`[API] Session check completed: ${session ? "Logged in" : "Guest"}`,
	);
	return {
		session,
		honoContext: context,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
