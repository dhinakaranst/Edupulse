import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ to: "/", label: "Home" },
		{ to: "/dashboard", label: "Dashboard" },
	] as const;

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-16 items-center justify-between px-4">
				<div className="flex items-center gap-8">
					<Link to="/" className="group flex items-center gap-2">
						<div className="rounded-lg bg-primary p-1.5 transition-transform group-hover:scale-110">
							<GraduationCap className="h-5 w-5 text-primary-foreground" />
						</div>
						<span className="font-bold text-xl tracking-tight">
							Edu<span className="text-primary">Pulse</span>
						</span>
					</Link>

					<nav className="hidden items-center gap-6 font-medium text-sm md:flex">
						{links.map(({ to, label }) => (
							<Link
								key={to}
								to={to}
								className="text-muted-foreground transition-colors hover:text-primary [&.active]:font-bold [&.active]:text-foreground"
							>
								{label}
							</Link>
						))}
					</nav>
				</div>

				<div className="flex items-center gap-4">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
