import { api } from "@sms/api";
import { fulfillPurchase } from "@sms/api/lib/payment-logic";
import { auth } from "@sms/auth";
import { env } from "@sms/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// Middlewares
app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

/**
 * 1. Better Auth Handler
 * Route: /api/auth/*
 */
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/**
 * 2. Stripe Webhook Handler (Raw HTTP)
 * Route: /api/payment/webhook
 */
app.post("/api/payment/webhook", async (c) => {
	const rawBody = await c.req.text();
	try {
		const event = JSON.parse(rawBody);
		if (event.type === "checkout.session.completed") {
			await fulfillPurchase(event.data.object);
		}
		return c.json({ received: true });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		console.error("Webhook Error:", errorMessage);
		return c.json({ error: `Webhook Error: ${errorMessage}` }, 400);
	}
});

/**
 * 3. Mount Business APIs (oRPC via Hono Router)
 * Route: /api/* (handles /api/rpc, /api/onboarding, etc. but auth takes priority above)
 */
app.route("/api", api);

// Main Entry
const server = Bun.serve({
	port: Number(env.PORT || 3000),
	hostname: "0.0.0.0",
	fetch: app.fetch,
});

console.log(`Started development server: ${server.url}`);
