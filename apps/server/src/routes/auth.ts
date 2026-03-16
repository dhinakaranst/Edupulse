import { Hono } from "hono";
import { auth } from "../lib/auth";

export const authRouter = new Hono();

/**
 * Better Auth Handler
 * Mounts all auth routes (login, register, session, etc.) automatically
 */
authRouter.on(["POST", "GET"], "/*", (c) => auth.handler(c.req.raw));

/**
 * Protected Route Example: /api/auth/me
 * Returns the current user's session if authenticated.
 */
authRouter.get("/me", async (c) => {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	return c.json(session);
});
