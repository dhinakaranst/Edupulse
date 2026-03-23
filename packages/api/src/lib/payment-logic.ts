import { db } from "@sms/db";
import { institution, member, user } from "@sms/db/schema/auth";
import { env } from "@sms/env/server";
import { and, eq } from "drizzle-orm";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: env.EMAIL_USER,
		pass: env.EMAIL_PASSWORD,
	},
});

import type Stripe from "stripe";

export async function fulfillPurchase(session: Stripe.Checkout.Session) {
	const { institutionId, planType } = session.metadata;
	const userId = session.metadata.userId || session.client_reference_id;

	console.log(
		`[PAYMENT] Fulfilling ${planType} plan for user ${userId} / institution: ${institutionId}`,
	);

	// 1. Update Institution Plan
	if (institutionId) {
		await db
			.update(institution)
			.set({
				plan: planType.charAt(0).toUpperCase() + planType.slice(1),
				subscriptionId: session.subscription,
			})
			.where(eq(institution.id, institutionId));
	} else {
		const [membership] = await db
			.select()
			.from(member)
			.where(and(eq(member.userId, userId), eq(member.role, "owner")))
			.limit(1);

		if (membership) {
			await db
				.update(institution)
				.set({
					plan: planType.charAt(0).toUpperCase() + planType.slice(1),
					subscriptionId: session.subscription,
				})
				.where(eq(institution.id, membership.organizationId));
		}
	}

	// 2. Send confirmation email
	try {
		const [currentUser] = await db
			.select()
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (currentUser) {
			console.log(
				`[PAYMENT] Sending confirmation email to ${currentUser.email}`,
			);
			await transporter.sendMail({
				from: `"EduPulse Payments" <${env.EMAIL_USER}>`,
				to: currentUser.email,
				subject: `Subscription Confirmed - ${planType.toUpperCase()} Plan`,
				html: `
					<div style="font-family: sans-serif; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #111827;">
						<div style="text-align: center; margin-bottom: 24px;">
							<h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">Payment Successful</h2>
						</div>
						<p>Hello <strong>${currentUser.name}</strong>,</p>
						<p>Your subscription to the <strong>${planType.toUpperCase()}</strong> plan has been successfully activated.</p>
						<a href="${env.CORS_ORIGIN.split(",")[0]}/dashboard" style="display: inline-block; background-color: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; width: 100%; text-align: center; box-sizing: border-box; margin-top: 16px;">Go to Dashboard</a>
					</div>
				`,
			});
		}
	} catch (mailErr) {
		console.error("[PAYMENT] Failed to send confirmation email:", mailErr);
	}
}
