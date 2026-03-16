import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@sms/api/context";
import { appRouter } from "@sms/api/routers/index";
import { env } from "@sms/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import nodemailer from "nodemailer";
import { apiRouter } from "./routes";


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
 * Central API Router
 * Mounts grouped routes: /api/auth, /api/payment, etc.
 */
app.route("/api", apiRouter);

// oRPC API Handlers
export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

// Main request dispatcher
app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/api/test-email", async (c) => {
	try {
		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: env.EMAIL_USER,
				pass: env.EMAIL_PASSWORD,
			},
		});

		await transporter.sendMail({
			from: "test@example.com", // Reverted to hardcoded email
			to: "test@example.com", // Reverted to hardcoded email
			subject: "Test Email",
			text: "If you see this, email is working!",
		});

		return c.json({ success: true, message: "Test email sent!" });
	} catch (error: any) {
		console.error("Test email failed:", error);
		return c.json({ success: false, error: error.message }, 500);
	}
});

export default {
	port: 3000,
	hostname: "127.0.0.1",
	fetch: app.fetch,
};



