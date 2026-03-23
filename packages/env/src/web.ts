import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_SERVER_URL: z.url(),
		VITE_STRIPE_PUBLISHABLE_KEY: z
			.string()
			.min(1, "Stripe Publishable Key is required"),
	},
	runtimeEnv: (import.meta as unknown as { env: Record<string, string> }).env,
	emptyStringAsUndefined: true,
});
