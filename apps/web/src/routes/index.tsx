import { Button } from "@sms/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Building2,
	CheckCircle2,
	ShieldCheck,
	Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<div className="relative flex min-h-[calc(100vh-65px)] flex-col items-center justify-center overflow-hidden bg-background">
			{/* Background Glow */}
			<div className="absolute top-1/2 left-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-primary/10 blur-[120px]" />

			<div className="container space-y-12 px-4 text-center">
				{/* Badge */}
				<div className="fade-in slide-in-from-top-4 inline-flex animate-in items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 font-medium text-muted-foreground text-xs duration-500">
					<Zap className="h-3 w-3 fill-primary text-primary" />
					<span>Next-Generation Institution Management</span>
				</div>

				{/* Hero Title */}
				<div className="mx-auto max-w-4xl space-y-4">
					<h1 className="fade-in slide-in-from-top-6 animate-in bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text font-extrabold text-5xl text-transparent tracking-tight delay-100 duration-700 md:text-7xl">
						Empower Your Institution <br /> with{" "}
						<span className="text-primary">EduPulse</span>
					</h1>
					<p className="fade-in slide-in-from-top-8 mx-auto max-w-2xl animate-in text-lg text-muted-foreground delay-200 duration-700 md:text-xl">
						The all-in-one platform for Schools, Medical Colleges, and
						Engineering Institutions to streamline operations, auth, and data
						management.
					</p>
				</div>

				{/* Call to Actions (Flow Diagram Steps) */}
				<div className="fade-in slide-in-from-top-10 flex animate-in flex-col items-center justify-center gap-4 delay-300 duration-700 sm:flex-row">
					<Link to="/login" search={{ showSignUp: true }}>
						<Button
							size="lg"
							className="group h-14 gap-2 px-8 font-bold text-lg shadow-lg shadow-primary/20"
						>
							Get Started / Register Institution
							<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Button>
					</Link>

					<Link to="/login">
						<Button
							size="lg"
							variant="outline"
							className="h-14 bg-background/50 px-8 font-bold text-lg backdrop-blur-sm"
						>
							Already Registered? Login
						</Button>
					</Link>
				</div>

				{/* Features List */}
				<div className="fade-in slide-in-from-bottom-10 mx-auto grid max-w-5xl animate-in grid-cols-1 gap-8 pt-12 delay-500 duration-1000 md:grid-cols-3">
					{[
						{
							icon: ShieldCheck,
							title: "Secure Auth",
							desc: "Enterprise-grade authentication with Better Auth integration.",
						},
						{
							icon: Building2,
							title: "Multi-Type Support",
							desc: "Tailored modules for Schools, Medical, and Engineering colleges.",
						},
						{
							icon: CheckCircle2,
							title: "Easy Onboarding",
							desc: "Register your institution and get started in under 2 minutes.",
						},
					].map((feature, i) => (
						<div
							key={i}
							className="group space-y-3 rounded-2xl border bg-card/50 p-6 text-left backdrop-blur-xl transition-colors hover:bg-card/80"
						>
							<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
								<feature.icon className="h-6 w-6 text-primary" />
							</div>
							<h3 className="font-bold text-xl">{feature.title}</h3>
							<p className="text-muted-foreground leading-relaxed">
								{feature.desc}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
