import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../lib/orpc";
import { attendanceRouter } from "./attendance";
import { managementRouter } from "./management";
import { onboardingRouter } from "./onboarding";
import { paymentRouter } from "./payment";
import { registerRouter } from "./register";
import { studentRouter } from "./student";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	onboarding: onboardingRouter,
	payment: paymentRouter,
	register: registerRouter,
	management: managementRouter,
	student: studentRouter,
	attendance: attendanceRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
