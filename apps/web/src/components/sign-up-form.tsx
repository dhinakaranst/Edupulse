import { Button } from "@sms/ui/components/button";
import { Input } from "@sms/ui/components/input";
import { Label } from "@sms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import Loader from "./loader";

const INSTITUTION_TYPES = [
	"School",
	"Medical",
	"Engg",
	"Arts",
	"Others",
] as const;

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const navigate = useNavigate({
		from: "/login",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
			phoneNumber: "",
			institutionName: "",
			institutionType: "School" as (typeof INSTITUTION_TYPES)[number],
		},
		onSubmit: async ({ value }) => {
			try {
				// 1. Sign up the user
				const { error: signUpError } = await authClient.signUp.email(
					{
						email: value.email,
						password: value.password,
						name: value.name,
						// @ts-ignore
						phoneNumber: value.phoneNumber,
					} as any,
					{
						onSuccess: async () => {
							// 2. Create the Institution (User is signed in)
							const { error: orgError } = await authClient.organization.create({
								name: value.institutionName,
								slug: value.institutionName.toLowerCase().replace(/\s+/g, "-"),
								// @ts-ignore
								type: value.institutionType,
							} as any);

							if (orgError) {
								toast.error(`Institution creation failed: ${orgError.message}`);
								return;
							}

							toast.success("Registration complete!");
							navigate({ to: "/pricing" });
						},
					},
				);

				if (signUpError && !signUpError.message?.toLowerCase().includes("already exists")) {
					toast.error(signUpError.message || "Failed to sign up");
					return;
				}

			} catch (err: any) {
				console.error("Submission error:", err);
				toast.error(err?.message || "An unexpected error occurred.");
			}
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Contact person name is required"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
				phoneNumber: z.string().min(10, "Valid mobile number is required"),
				institutionName: z.string().min(3, "Institution name is required"),
				institutionType: z.enum(INSTITUTION_TYPES),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-5 w-full max-w-lg rounded-xl border bg-card p-8 shadow-lg">
			<h1 className="mb-2 text-center font-extrabold text-3xl tracking-tight">
				Get Started
			</h1>
			<p className="mb-8 text-center text-muted-foreground">
				Register your institution to begin
			</p>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-6"
			>
				<div className="space-y-4">
					<h2 className="font-semibold text-primary text-sm uppercase tracking-wider">
						Institution Details
					</h2>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<form.Field name="institutionName">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Institution Name</Label>
									<Input
										id={field.name}
										placeholder="e.g. Green Valley School"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="institutionType">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Institution Type</Label>
									<select
										id={field.name}
										className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value as any)}
									>
										{INSTITUTION_TYPES.map((type) => (
											<option key={type} value={type}>
												{type}
											</option>
										))}
									</select>
								</div>
							)}
						</form.Field>
					</div>
				</div>

				<div className="space-y-4">
					<h2 className="font-semibold text-primary text-sm uppercase tracking-wider">
						Contact Person Details
					</h2>
					<div className="grid grid-cols-1 gap-4">
						<form.Field name="name">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Full Name</Label>
									<Input
										id={field.name}
										placeholder="Contact Person Name"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
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
											placeholder="email@institution.com"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
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
							{isSubmitting ? "Processing..." : "Submit Registration"}
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
