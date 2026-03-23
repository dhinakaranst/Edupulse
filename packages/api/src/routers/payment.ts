import { db } from "@sms/db";
import { member } from "@sms/db/schema/auth";
import { env } from "@sms/env/server";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import { protectedProcedure } from "../lib/orpc";
import { fulfillPurchase } from "../lib/payment-logic";

const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, {

	apiVersion: "2025-02-24.acacia",
});

export const paymentRouter = {
	createCheckoutSession: protectedProcedure
		.input(
			z.object({
				priceId: z.string(),
				planType: z.string(),
				billing: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { priceId, planType, billing } = input;
			const userId = context.session.user.id;

			const [membership] = await db
				.select()
				.from(member)
				.where(and(eq(member.userId, userId), eq(member.role, "owner")))
				.limit(1);

			const institutionId = membership?.organizationId;

			const checkoutSession = await stripe.checkout.sessions.create({
				mode: "subscription",
				payment_method_types: ["card"],
				line_items: [{ price: priceId, quantity: 1 }],
				success_url: `${env.CORS_ORIGIN.split(",")[0]}/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${env.CORS_ORIGIN.split(",")[0]}/pricing`,
				client_reference_id: userId,
				metadata: {
					planType,
					billing,
					userId: userId,
					institutionId: institutionId || "",
				},
			});

			return {
				sessionId: checkoutSession.id,
				url: checkoutSession.url,
			};
		}),

	confirmSession: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			const session = await stripe.checkout.sessions.retrieve(input.sessionId);
			if (session.payment_status === "paid" || session.status === "complete") {
				await fulfillPurchase(session);
			}
			return { success: true };
		}),
};
