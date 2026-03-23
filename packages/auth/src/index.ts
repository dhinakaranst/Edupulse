import { db } from "@sms/db";
import * as schema from "@sms/db/schema/auth";
import { env } from "@sms/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: env.EMAIL_USER,
		pass: env.EMAIL_PASSWORD,
	},
});

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
			organization: schema.institution,
			member: schema.member,
			invitation: schema.invitation,
			team: schema.team,
			teamMember: schema.teamMember,
		},
	}),

	user: {
		additionalFields: {
			phoneNumber: {
				type: "string",
			},
			hasChangedPassword: {
				type: "boolean",
			},
		},
	},

	emailAndPassword: {
		enabled: true,
	},

	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: env.CORS_ORIGIN.split(","),

	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
		},
	},

	plugins: [
		organization({
			allowUserToCreateOrganization: true,
			organization: {
				additionalFields: {
					type: {
						type: "string",
					},
				},
			},
		}),
		emailOTP({
			async sendVerificationOTP({
				email,
				otp,
				type,
			}: {
				email: string;
				otp: string;
				type: string;
			}) {
				console.info(
					`[AUTH] Hook triggered! Sending OTP (${type}) to ${email}: ${otp}`,
				);
				try {
					await transporter.sendMail({
						from: `"EduPulse Support" <${env.EMAIL_USER}>`,
						to: email,
						subject: "Verify your email - EduPulse",
						html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
              <h2 style="color: #4f46e5;">Welcome to EduPulse</h2>
              <p>Your one-time password (OTP) for registration is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4f46e5; margin: 20px 0;">${otp}</div>
              <p style="color: #666; font-size: 14px;">This code will expire shortly. Do not share it with anyone.</p>
            </div>
          `,
					});
					console.info(`[AUTH] OTP sent successfully to ${email}`);
				} catch (error) {
					console.error("[AUTH] Failed to send OTP email:", error);
					throw error;
				}
			},
		}),
	],
});
