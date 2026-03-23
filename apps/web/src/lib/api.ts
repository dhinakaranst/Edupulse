import type { AppType } from "@sms/api";
import { env } from "@sms/env/web";
import { hc } from "hono/client";

/**
 * Type-safe client for ALL APIs
 * Includes business logic (oRPC), Auth, and Webhooks
 */
export const api = hc<AppType>(`${env.VITE_SERVER_URL}/api`, {
	headers() {
		return {
			// Add any dynamic headers here
		};
	},
});

/**
 * Example Usage:
 * const result = await api.rpc.onboarding.upload.$post({ form: { file, institutionId } });
 *
 * NOTE: For oRPC's .mutate style, you should continue using
 * the dedicated orpc utility which integrates with TanStack Query.
 */
