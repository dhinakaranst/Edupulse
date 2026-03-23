import { ORPCError } from "@orpc/server";
import { auth } from "@sms/auth";
import { db } from "@sms/db";
import { institution, member, user, verification } from "@sms/db/schema/auth";
import { env } from "@sms/env/server";
import { and, eq, gt } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { publicProcedure } from "../lib/orpc";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
});

export const registerRouter = {
	sendOtp: publicProcedure
		.input(z.object({ email: z.string().email() }))
		.handler(async ({ input }) => {
			const { email } = input;

			// Check if email is already registered
			const [existingUser] = await db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, email))
				.limit(1);

			if (existingUser) {
				throw new ORPCError("CONFLICT", {
					message: "An account with this email already exists.",
				});
			}

			// Generate a 6-digit OTP
			const otp = Math.floor(100000 + Math.random() * 900000).toString();
			const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

			// Clean up old OTPS for this email
			await db
				.delete(verification)
				.where(eq(verification.identifier, `pre-register:${email}`));

			// Store OTP in verification table
			await db.insert(verification).values({
				id: crypto.randomUUID(),
				identifier: `pre-register:${email}`,
				value: otp,
				expiresAt,
			});

			// Send OTP email
			try {
				await transporter.sendMail({
					from: `"EduPulse Support" <${env.EMAIL_USER}>`,
					to: email,
					subject: "Your EduPulse Registration OTP",
					html: `
						<div style="font-family: sans-serif; padding: 24px; border: 1px solid #eee; border-radius: 12px; max-width: 500px;">
							<h2 style="color: #4f46e5; margin-top: 0;">Welcome to EduPulse</h2>
							<p>Use the following OTP to verify your email address and complete registration:</p>
							<div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; margin: 24px 0; text-align: center;">
								${otp}
							</div>
							<p style="color: #666; font-size: 13px;">⏱ This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
						</div>
					`,
				});
			} catch (err) {
				console.error("[REGISTER] Failed to send OTP email:", err);
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to send OTP email.",
				});
			}

			return { success: true };
		}),

	verifyAndCreate: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				otp: z.string().length(6),
				name: z.string(),
				password: z.string().min(8),
				phoneNumber: z.string(),
				institutionName: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { email, otp, name, password, phoneNumber, institutionName } =
				input;

			// 1. Find and validate OTP
			const [record] = await db
				.select()
				.from(verification)
				.where(
					and(
						eq(verification.identifier, `pre-register:${email}`),
						gt(verification.expiresAt, new Date()),
					),
				)
				.limit(1);

			if (!record) {
				throw new ORPCError("BAD_REQUEST", {
					message: "OTP is invalid or has expired.",
				});
			}

			if (record.value !== otp) {
				throw new ORPCError("BAD_REQUEST", { message: "Incorrect OTP." });
			}

			// 2. OTP is valid — delete it
			await db.delete(verification).where(eq(verification.id, record.id));

			// 3. Create the user
			const signUpResponse = await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					// @ts-expect-error
					phoneNumber,
				},
			});

			if (!signUpResponse || !signUpResponse.user) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create account.",
				});
			}

			// 4. Create the Institution
			const orgId = crypto.randomUUID();
			const slug = institutionName.toLowerCase().replace(/\s+/g, "-");

			await db.insert(institution).values({
				id: orgId,
				name: institutionName,
				slug,
			});

			// 5. Add user as owner
			await db.insert(member).values({
				id: crypto.randomUUID(),
				organizationId: orgId,
				userId: signUpResponse.user.id,
				role: "owner",
			});

			// 6. Sign in and get cookie
			const signInResponse = await auth.api.signInEmail({
				body: { email, password },
				asResponse: true,
			});

			const setCookie = signInResponse.headers.get("set-cookie");
			if (setCookie && context.honoContext) {
				context.honoContext.header("Set-Cookie", setCookie);
			}

			const signInData = (await signInResponse.json()) as { user?: unknown };

			return {
				success: true,
				user: signInData?.user || signUpResponse.user,
			};
		}),
};
