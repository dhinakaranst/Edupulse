import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@sms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@sms/ui/components/card";
import { Input } from "@sms/ui/components/input";
import { Label } from "@sms/ui/components/label";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const Route = createFileRoute("/change-password")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: ChangePasswordPage,
});

function ChangePasswordPage() {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ChangePasswordValues>({
		resolver: zodResolver(changePasswordSchema),
	});

	async function onSubmit(values: ChangePasswordValues) {
		setIsLoading(true);
		try {
			// 1. Change password via better-auth
			const { error } = await authClient.changePassword({
				newPassword: values.newPassword,
				currentPassword: values.currentPassword,
				revokeOtherSessions: true,
			});

			if (error) {
				throw new Error(error.message || "Failed to change password");
			}

			// 2. Update the flag in user metadata/table via oRPC
			await client.onboarding.completePasswordChange({});

			toast.success("Security status updated successfully!");

			// 3. Refresh session and redirect
			await authClient.getSession();
			navigate({ to: "/dashboard" });
		} catch (err: any) {
			console.error(err);
			toast.error(err.message || "An error occurred while changing password.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4 dark:bg-[#09090b]">
			<Card className="w-full max-w-md border-border/50 bg-card/40 shadow-2xl backdrop-blur-sm">
				<CardHeader className="space-y-1">
					<div className="mx-auto mb-4 flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-primary/10 transition-transform hover:rotate-0">
						<ShieldCheck className="h-8 w-8 text-primary" />
					</div>
					<CardTitle className="text-center font-black text-3xl tracking-tight">
						Security Check
					</CardTitle>
					<CardDescription className="text-center font-medium italic">
						You must update your temporary password to continue.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
						<div className="space-y-2">
							<Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest">
								Current Temporary Password
							</Label>
							<div className="relative">
								<Input
									placeholder="Paste your temporary password"
									type={showCurrent ? "text" : "password"}
									className="h-12 border-border/40 font-mono transition-all focus:border-primary/50"
									{...register("currentPassword")}
								/>
								<button
									type="button"
									onClick={() => setShowCurrent(!showCurrent)}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
								>
									{showCurrent ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
							{errors.currentPassword && (
								<p className="font-bold text-[10px] text-destructive uppercase tracking-wider">
									{errors.currentPassword.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest">
								New Secure Password
							</Label>
							<div className="relative">
								<Input
									placeholder="Minimum 8 characters"
									type={showNew ? "text" : "password"}
									className="h-12 border-border/40 transition-all focus:border-primary/50"
									{...register("newPassword")}
								/>
								<button
									type="button"
									onClick={() => setShowNew(!showNew)}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
								>
									{showNew ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
							{errors.newPassword && (
								<p className="font-bold text-[10px] text-destructive uppercase tracking-wider">
									{errors.newPassword.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest">
								Confirm New Password
							</Label>
							<Input
								placeholder="Repeat new password"
								type="password"
								className="h-12 border-border/40 transition-all focus:border-primary/50"
								{...register("confirmPassword")}
							/>
							{errors.confirmPassword && (
								<p className="font-bold text-[10px] text-destructive uppercase tracking-wider">
									{errors.confirmPassword.message}
								</p>
							)}
						</div>

						<Button
							type="submit"
							className="mt-4 h-14 w-full font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-5 w-5 animate-spin" />
									Updating Security Portal...
								</>
							) : (
								<>
									<Lock className="mr-2 h-5 w-5" />
									Finalize & Access Dashboard
								</>
							)}
						</Button>
					</form>
				</CardContent>
				<CardFooter className="flex flex-col border-border/20 border-t bg-muted/20 px-8 pt-6 pb-8">
					<div className="mb-3 flex items-center gap-2">
						<div className="h-px flex-1 bg-border/40" />
						<span className="font-black text-[8px] text-muted-foreground/50 uppercase tracking-[0.2em]">
							Security Protocol
						</span>
						<div className="h-px flex-1 bg-border/40" />
					</div>
					<p className="text-center font-medium text-[10px] text-muted-foreground italic leading-relaxed">
						Your privacy is our priority. EduPulse uses end-to-end encryption
						for session management.
					</p>
				</CardFooter>
			</Card>
		</div>
	);
}
