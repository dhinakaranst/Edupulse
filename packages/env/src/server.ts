import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.string().min(1),
		EMAIL_USER: z.string().email(),
		EMAIL_PASSWORD: z.string().min(1),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		STRIPE_SECRET_KEY: z.string().min(1, "Stripe Secret Key is required"),
	},

	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
