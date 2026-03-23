import { Button } from "@sms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@sms/ui/components/dropdown-menu";
import { Skeleton } from "@sms/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	const handleSignOut = async () => {
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						navigate({ to: "/" });
						toast.success("Signed out successfully.");
					},
				},
			});
		} catch (error) {
			console.error("Sign out failed", error);
			toast.error("Failed to sign out. Please try again.");
		}
	};

	if (isPending) {
		return (
			<Skeleton className="h-9 w-24 animate-pulse rounded-lg bg-muted/40" />
		);
	}

	if (!session) {
		return (
			<Link to="/login">
				<Button
					variant="outline"
					className="border-primary/50 text-primary hover:bg-primary/5"
				>
					Sign In
				</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						className="gap-2 border-border/60 px-3 hover:border-primary/50"
					/>
				}
			>
				<span className="max-w-[120px] truncate">{session.user.name}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="mt-1 w-56 border border-border/50 bg-card p-1 shadow-xl"
				align="end"
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="flex flex-col gap-0.5 px-3 pt-3 pb-2">
						<span className="font-bold text-foreground text-sm">
							{session.user.name}
						</span>
						<span className="truncate font-medium text-[10px] text-muted-foreground">
							{session.user.email}
						</span>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator className="mx-1 my-1" />
				<DropdownMenuGroup className="px-1">
					<DropdownMenuItem
						className="cursor-pointer gap-2 py-2"
						onClick={() => navigate({ to: "/dashboard" })}
					>
						Go to Dashboard
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						className="mt-1 cursor-pointer gap-2 py-2 focus:bg-destructive/10"
						onClick={handleSignOut}
					>
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
