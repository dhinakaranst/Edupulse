import { Button } from "@sms/ui/components/button";
import { Input } from "@sms/ui/components/input";
import { Label } from "@sms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Mail, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";
import Loader from "./loader";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "register" | "verify-otp";

interface RegisterValues {
	email: string;
	password: string;
	name: string;
	phoneNumber: string;
	institutionName: string;
}

// ─── OTP Input Component ──────────────────────────────────────────────────────
function _OtpInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	const inputs = useRef<(HTMLInputElement | null)[]>([]);
	const digits = value.padEnd(6, "").split("").slice(0, 6);

	const handleChange = (idx: number, char: string) => {
		const cleaned = char.replace(/\D/g, "").slice(-1);
		const next = [...digits];
		next[idx] = cleaned;
		const joined = next.join("").slice(0, 6);
		onChange(joined);
		if (cleaned && idx < 5) {
			inputs.current[idx + 1]?.focus();
		}
	};

	const handleKeyDown = (
		idx: number,
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Backspace" && !digits[idx] && idx > 0) {
			inputs.current[idx - 1]?.focus();
		}
	};

	return (
		<div
			style={{
				display: "flex",
				gap: "10px",
				justifyContent: "center",
				margin: "20px 0",
			}}
		>
			{digits.map((d, i) => (
				<input
					key={i}
					ref={(el) => {
						inputs.current[i] = el;
					}}
					type="text"
					inputMode="numeric"
					maxLength={1}
					value={d}
					style={{
						width: "52px",
						height: "60px",
						textAlign: "center",
						fontSize: "24px",
						fontWeight: "800",
						color: "#111827",
						backgroundColor: "#f9fafb",
						border: "2px solid #e5e7eb",
						borderRadius: "12px",
						outline: "none",
						boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
						transition: "border-color 0.15s, box-shadow 0.15s",
					}}
					onFocus={(e) => {
						e.target.style.borderColor = "#6366f1";
						e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
					}}
					onBlur={(e) => {
						e.target.style.borderColor = d ? "#6366f1" : "#e5e7eb";
						e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
					}}
					onChange={(e) => handleChange(i, e.target.value)}
					onKeyDown={(e) => handleKeyDown(i, e)}
				/>
			))}
		</div>
	);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const navigate = useNavigate({ from: "/login" });
	const { isPending } = authClient.useSession();

	const [step, setStep] = useState<Step>("register");
	const [otp, setOtp] = useState("");
	const [isVerifying, setIsVerifying] = useState(false);
	const [isResending, setIsResending] = useState(false);
	// Store registration values so we can use them after OTP verification
	const pendingValues = useRef<RegisterValues | null>(null);

	// ── Registration Form ────────────────────────────────────────────────────
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
			phoneNumber: "",
			institutionName: "",
		},
		onSubmit: async ({ value }) => {
			try {
				// Only send OTP — user is NOT created in the DB yet!
				await client.register.sendOtp({ email: value.email });

				// Store form values — we'll use them after OTP verified
				pendingValues.current = value;
				toast.success(`OTP sent to ${value.email}!`);
				setStep("verify-otp");
			} catch (err: any) {
				console.error("Send OTP error:", err);
				toast.error(err?.message || "An unexpected error occurred.");
			}
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Contact person name is required"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
				phoneNumber: z.string().min(10, "Valid mobile number is required"),
				institutionName: z
					.string()
					.min(3, "Institution / Trust name is required"),
			}),
		},
	});

	// ── OTP Verification ─────────────────────────────────────────────────────
	const handleVerifyOtp = async () => {
		if (!pendingValues.current) return;
		if (otp.length !== 6) {
			toast.error("Please enter the complete 6-digit OTP");
			return;
		}

		setIsVerifying(true);
		try {
			const values = pendingValues.current;

			// Verify OTP + create user + create org — all in one atomic backend call
			// User is NOT created in DB until this step succeeds!
			await client.register.verifyAndCreate({
				email: values.email,
				otp,
				name: values.name,
				password: values.password,
				phoneNumber: values.phoneNumber,
				institutionName: values.institutionName,
			});

			toast.success("Email verified! Let's choose your plan.");
			navigate({ to: "/pricing" });
		} catch (err: any) {
			console.error("OTP verification error:", err);
			toast.error(err?.message || "Verification failed.");
		} finally {
			setIsVerifying(false);
		}
	};

	const handleResendOtp = async () => {
		if (!pendingValues.current) return;
		setIsResending(true);
		try {
			await client.register.sendOtp({ email: pendingValues.current.email });
			toast.success("A new OTP has been sent to your email.");
		} catch (err: any) {
			toast.error(err?.message || "Failed to resend OTP.");
		} finally {
			setIsResending(false);
		}
	};

	if (isPending) return <Loader />;

	// ── OTP Step UI ──────────────────────────────────────────────────────────
	if (step === "verify-otp") {
		return (
			<div className="mx-auto mt-5 w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-lg">
				<div className="flex flex-col items-center gap-3">
					<div className="rounded-full bg-primary/10 p-4">
						<ShieldCheck className="h-8 w-8 text-primary" />
					</div>
					<h1 className="font-extrabold text-2xl tracking-tight">
						Verify Your Email
					</h1>
					<p className="max-w-xs text-muted-foreground text-sm">
						We sent a 6-digit code to{" "}
						<span className="font-semibold text-foreground">
							{pendingValues.current?.email}
						</span>
						. Enter it below to confirm your account.
					</p>
				</div>

				{/* ── OTP Input ── */}
				<div>
					<input
						type="text"
						inputMode="numeric"
						maxLength={6}
						placeholder="Enter 6-digit OTP"
						value={otp}
						onChange={(e) =>
							setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
						}
						style={{
							width: "100%",
							padding: "16px",
							fontSize: "28px",
							fontWeight: "800",
							letterSpacing: "16px",
							textAlign: "center",
							color: "#111827",
							backgroundColor: "#f3f4f6",
							border: "2px solid #6366f1",
							borderRadius: "12px",
							outline: "none",
						}}
					/>
					<p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>
						{otp.length}/6 digits entered
					</p>
				</div>

				<Button
					className="h-12 w-full font-semibold text-base"
					onClick={handleVerifyOtp}
					disabled={isVerifying || otp.length !== 6}
				>
					{isVerifying ? "Verifying..." : "Verify & Continue"}
				</Button>

				<div className="flex items-center justify-center gap-1 pt-2 text-muted-foreground text-sm">
					<Mail className="h-4 w-4" />
					<span>Didn't get the email?</span>
					<Button
						variant="link"
						className="h-auto p-0 font-semibold text-primary text-sm"
						onClick={handleResendOtp}
						disabled={isResending}
					>
						{isResending ? "Sending..." : "Resend OTP"}
					</Button>
				</div>

				<Button
					variant="ghost"
					className="w-full text-muted-foreground"
					onClick={() => {
						setStep("register");
						setOtp("");
					}}
				>
					← Back to Registration
				</Button>
			</div>
		);
	}

	// ── Registration Step UI ─────────────────────────────────────────────────
	return (
		<div className="mx-auto mt-5 w-full max-w-lg rounded-xl border bg-card p-8 shadow-lg">
			<h1 className="mb-2 text-center font-extrabold text-3xl tracking-tight">
				Get Started
			</h1>
			<p className="mb-2 text-center text-muted-foreground">
				Register your institution to begin
			</p>
			<p className="mb-8 text-center text-muted-foreground/70 text-xs">
				You can add individual colleges or schools in the next steps.
			</p>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-6"
			>
				{/* Institution Details */}
				<div className="space-y-4">
					<h2 className="font-semibold text-primary text-sm uppercase tracking-wider">
						Institution / Trust Details
					</h2>
					<form.Field name="institutionName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Institution / Trust Name</Label>
								<Input
									id={field.name}
									placeholder="e.g. KSR Institutions, Green Valley Educational Trust"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<p className="text-muted-foreground text-xs">
									Colleges, schools & campuses are added after setup.
								</p>
								{field.state.meta.errors.length > 0 && (
									<p className="text-destructive text-xs">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>
				</div>

				{/* Admin Details */}
				<div className="space-y-4">
					<h2 className="font-semibold text-primary text-sm uppercase tracking-wider">
						Admin Contact Details
					</h2>
					<div className="grid grid-cols-1 gap-4">
						<form.Field name="name">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Full Name</Label>
									<Input
										id={field.name}
										placeholder="Institution Admin's Full Name"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-destructive text-xs">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								</div>
							)}
						</form.Field>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<form.Field name="email">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Email Address</Label>
										<Input
											id={field.name}
											type="email"
											placeholder="admin@institution.com"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{field.state.meta.errors.length > 0 && (
											<p className="text-destructive text-xs">
												{field.state.meta.errors[0]?.message}
											</p>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="phoneNumber">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Mobile Number</Label>
										<Input
											id={field.name}
											type="tel"
											placeholder="+91 9876543210"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{field.state.meta.errors.length > 0 && (
											<p className="text-destructive text-xs">
												{field.state.meta.errors[0]?.message}
											</p>
										)}
									</div>
								)}
							</form.Field>
						</div>

						<form.Field name="password">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Create Password</Label>
									<Input
										id={field.name}
										type="password"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-destructive text-xs">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								</div>
							)}
						</form.Field>
					</div>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							type="submit"
							className="h-12 w-full font-semibold text-lg"
							disabled={!canSubmit || isSubmitting}
						>
							{isSubmitting ? "Sending OTP..." : "Register & Verify Email"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-6 text-center text-sm">
				<span className="text-muted-foreground">Already have an account? </span>
				<Button
					variant="link"
					onClick={onSwitchToSignIn}
					className="h-auto p-0 font-bold text-primary"
				>
					Sign In
				</Button>
			</div>
		</div>
	);
}
