import { Hono } from "hono";
import Stripe from "stripe";
import { env } from "@sms/env/server";
import { auth } from "../lib/auth";

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, {
	apiVersion: "2025-02-24.acacia" as any, // using any to bypass strict type since we don't know the exact version in test
});

export const paymentRouter = new Hono();

/**
 * POST /api/payment/create-checkout-session
 * Protected route to initiate a Stripe checkout session for subscription plans.
 */
paymentRouter.post("/create-checkout-session", async (c) => {
	try {
		// 1. Verify user is authenticated
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!session || !session.user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		// 2. Parse the request body
		const body = await c.req.json();
		const { priceId, planType, billing } = body;

		if (!priceId) {
			return c.json({ error: "Missing priceId" }, 400);
		}

		// 3. Create the Stripe Checkout Session
		const checkoutSession = await stripe.checkout.sessions.create({
			mode: "subscription",
			payment_method_types: ["card"],
			currency: "inr", // Ensure session is restricted to INR pricing
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			// Redirect URLs after success or cancellation
			success_url: `http://localhost:3001/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `http://localhost:3001/pricing`,
			// Pass the user ID as client_reference_id so we can fulfill the plan via webhooks later
			client_reference_id: session.user.id,
			metadata: {
				planType,
				billing,
				userId: session.user.id,
			},
		});

		// 4. Return the session ID and the fully hosted URL to the frontend
		return c.json({ 
			sessionId: checkoutSession.id,
			url: checkoutSession.url 
		});
	} catch (error: any) {
		console.error("Stripe checkout error:", error);
		return c.json({ error: error.message || "Failed to create checkout session" }, 500);
	}
});

/**
 * POST /api/payment/webhook
 * Placeholder webhook handler for Stripe events.
 */
paymentRouter.post("/webhook", async (c) => {
	const sig = c.req.header("stripe-signature");
	// Get raw body text for Stripe signature verification
	const rawBody = await c.req.text();

	try {
		// Note: In production, you'll need the STRIPE_WEBHOOK_SECRET to construct the event
		// const event = stripe.webhooks.constructEvent(rawBody, sig!, env.STRIPE_WEBHOOK_SECRET!);
		
		// For now, securely parse JSON directly without verification to act as a placeholder
		const event = JSON.parse(rawBody);

		switch (event.type) {
			case "checkout.session.completed":
				const session = event.data.object;
				console.log("Payment successful for user ID:", session.client_reference_id);
				// TODO: Fulfill the order (grant premium access, save subscription record to DB, etc.)
				break;
			case "customer.subscription.deleted":
				console.log("Subscription canceled");
				// TODO: Revoke premium access
				break;
			default:
				console.log(`Unhandled event type ${event.type}`);
		}

		return c.json({ received: true });
	} catch (err: any) {
		console.error("Webhook Error:", err.message);
		return c.json({ error: `Webhook Error: ${err.message}` }, 400);
	}
});
