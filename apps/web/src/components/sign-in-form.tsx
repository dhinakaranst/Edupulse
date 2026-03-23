import { Button } from "@sms/ui/components/button";
import { Input } from "@sms/ui/components/input";
import { Label } from "@sms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/login",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: (ctx) => {
						const hasChangedPassword = (ctx.data.user as { hasChangedPassword?: boolean })
							.hasChangedPassword;

						if (hasChangedPassword === false) {
							navigate({
								to: "/change-password",
							});
						} else {
							navigate({
								to: "/dashboard",
							});
						}
						toast.success("Welcome back!");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.string().min(1, "Email or Mobile is required"),
				password: z.string().min(1, "Password is required"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
			<h1 className="mb-2 text-center font-extrabold text-3xl tracking-tight">
				Login
			</h1>
			<p className="mb-8 text-center text-muted-foreground">
				Access your institution dashboard
			</p>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-6"
			>
				<div>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Email / Mobile Number</Label>
								<Input
									id={field.name}
									name={field.name}
									placeholder="Enter your email or mobile"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor={field.name}>Password</Label>
									<Button
										variant="link"
										className="h-auto p-0 font-semibold text-xs"
									>
										Forgot password?
									</Button>
								</div>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									placeholder="••••••••"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						)}
					</form.Field>
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
							{isSubmitting ? "Logging in..." : "Login"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-8 border-t pt-6 text-center text-sm">
				<p className="mb-4 text-muted-foreground">Are you a new institution?</p>
				<Button
					variant="outline"
					onClick={onSwitchToSignUp}
					className="w-full border-primary font-bold text-primary hover:bg-primary/5"
				>
					Register / Get Started
				</Button>
			</div>
		</div>
	);
}
