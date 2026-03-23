import { Button } from "@sms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@sms/ui/components/card";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/pricing")({
	component: PlanSelection,
});

function PlanSelection() {
	const _navigate = useNavigate();
	const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
	const [isYearly, setIsYearly] = useState(false);

	// Trigger Stripe Checkout
	const handleSelectPlan = async (priceId: string, planType: string) => {
		setLoadingPlan(priceId);
		try {
			toast.info("Preparing secure checkout...", { duration: 3000 });

			const { url } = await client.payment.createCheckoutSession({
				priceId,
				planType,
				billing: isYearly ? "yearly" : "monthly",
			});

			if (!url) {
				throw new Error("Invalid checkout URL returned from server");
			}

			// Redirect out of our app to the hosted Stripe Checkout UI natively
			window.location.href = url;
		} catch (e: any) {
			console.error(e);
			toast.error(e.message || "Failed to connect to secure checkout.");
			setLoadingPlan(null);
		}
	};

	const EXCHANGE_RATE = 84;

	// Base USD prices
	const standardMonthlyUSD = 49;
	const premiumMonthlyUSD = 99;

	// Convert to INR and round
	const standardMonthlyINR = Math.round(standardMonthlyUSD * EXCHANGE_RATE);
	const premiumMonthlyINR = Math.round(premiumMonthlyUSD * EXCHANGE_RATE);

	// Yearly prices with 20% discount
	const standardYearlyINR = Math.round(standardMonthlyINR * 12 * 0.8);
	const premiumYearlyINR = Math.round(premiumMonthlyINR * 12 * 0.8);

	// Effective monthly price when billed yearly
	const standardEffectiveMonthlyINR = Math.round(standardYearlyINR / 12);
	const premiumEffectiveMonthlyINR = Math.round(premiumYearlyINR / 12);

	// Formatter for Indian Rupees
	const formatINR = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Use valid Stripe Price/Product IDs here from your Stripe Dashboard
	const standardPriceId = isYearly
		? "price_1TBUs92LOh90fzBRx5KQzIFc"
		: "price_1TBUr62LOh90fzBRaB1sniPX";
	const premiumPriceId = isYearly
		? "price_1TBUvq2LOh90fzBRkY0OQq6T"
		: "price_1TBUuj2LOh90fzBRWkJV6wFr";

	// Realistic features for Indian Schools & Colleges
	const standardFeatures = [
		"Unlimited students & staff",
		"Full attendance, exam & marks management",
		"Fee collection & receipt generation",
		"Timetable & notices publishing",
		"Basic reporting & CBSE/State Board formats",
		"Email & local community support",
	];

	const premiumFeatures = [
		"Everything in Standard, plus:",
		"AI analytics & student dropout prediction",
		"Custom branding & white-label mobile app",
		"Biometric & RFID device integration",
		"Payment Gateway auto-reconciliation",
		"Full API access & webhooks",
		"24/7 priority phone & email support",
	];

	return (
		<div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 pt-10 pb-20">
			<div className="mb-10 space-y-4 pt-10 text-center">
				<h1 className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text font-extrabold text-4xl text-transparent tracking-tight md:text-5xl">
					Choose Your Plan
				</h1>
				<p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
					Select the plan that best fits your institution. Secure payments
					powered by
					<span className="mx-1 inline-flex items-center gap-1 font-semibold text-foreground">
						Stripe
					</span>
				</p>
			</div>

			{/* Monthly/Yearly Toggle */}
			<div className="mx-auto mb-10 flex items-center justify-center gap-3 rounded-full border border-border/50 bg-muted/50 p-1.5">
				<button
					onClick={() => setIsYearly(false)}
					className={`rounded-full px-5 py-2 font-semibold text-sm transition-all duration-200 ${
						!isYearly
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:bg-background/50 hover:text-foreground"
					}`}
				>
					Monthly
				</button>
				<button
					onClick={() => setIsYearly(true)}
					className={`flex items-center gap-2 rounded-full px-5 py-2 font-semibold text-sm transition-all duration-200 ${
						isYearly
							? "bg-background text-foreground shadow-sm ring-1 ring-primary/20"
							: "text-muted-foreground hover:bg-background/50 hover:text-foreground"
					}`}
				>
					Yearly
					<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-[10px] text-emerald-500 uppercase tracking-wider">
						Save 20%
					</span>
				</button>
			</div>

			<div className="mx-auto grid w-full max-w-5xl items-stretch gap-8 md:grid-cols-2">
				{/* Standard Plan */}
				<Card className="flex flex-col border-border/60 bg-card/60 shadow-lg backdrop-blur transition-all duration-300 hover:border-border hover:shadow-xl">
					<CardHeader>
						<CardTitle className="font-bold text-3xl">Standard</CardTitle>
						<CardDescription className="mt-2 text-base">
							Everything you need for small to medium institutions.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 space-y-6">
						<div>
							<div className="flex items-baseline gap-2">
								<span className="font-extrabold text-5xl tracking-tight">
									{isYearly
										? formatINR(standardYearlyINR)
										: formatINR(standardMonthlyINR)}
								</span>
								<span className="font-medium text-muted-foreground">
									{isYearly ? "/ year" : "/ month"}
								</span>
							</div>
							{isYearly && (
								<div className="mt-2 font-medium text-emerald-500 text-sm">
									Save 20% &bull; {formatINR(standardEffectiveMonthlyINR)} /mo
									billed yearly
								</div>
							)}
						</div>

						<ul className="space-y-4 pt-4">
							{standardFeatures.map((feature, idx) => (
								<li key={idx} className="flex items-start gap-3">
									<Check className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
									<span className="text-muted-foreground">{feature}</span>
								</li>
							))}
						</ul>
					</CardContent>
					<CardFooter className="flex-col gap-3">
						<Button
							className="h-14 w-full font-semibold text-lg"
							variant="default"
							disabled={loadingPlan !== null}
							onClick={() => handleSelectPlan(standardPriceId, "standard")}
						>
							{loadingPlan === standardPriceId
								? "Redirecting..."
								: "Select Plan"}
						</Button>
						<div className="flex w-full items-center justify-center gap-1.5 font-medium text-muted-foreground text-xs">
							<Lock className="h-3.5 w-3.5" />
							Secure checkout by Stripe
						</div>
					</CardFooter>
				</Card>

				{/* Premium Plan */}
				<Card className="relative z-10 flex flex-col overflow-hidden border-primary/50 bg-primary/5 shadow-primary/10 shadow-xl ring-1 ring-primary/30 backdrop-blur transition-all duration-300 hover:shadow-primary/20 sm:scale-105">
					<div className="absolute top-0 right-0 rounded-bl-xl bg-primary px-4 py-1.5 font-bold text-primary-foreground text-xs tracking-wide shadow-sm">
						MOST POPULAR
					</div>
					<CardHeader>
						<CardTitle className="flex items-center gap-3 font-bold text-3xl">
							Premium
						</CardTitle>
						<CardDescription className="mt-2 font-medium text-base text-foreground/80">
							The ultimate solution for enterprise scaling and intelligence.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 space-y-6">
						<div>
							<div className="flex items-baseline gap-2">
								<span className="font-extrabold text-5xl text-primary tracking-tight">
									{isYearly
										? formatINR(premiumYearlyINR)
										: formatINR(premiumMonthlyINR)}
								</span>
								<span className="font-medium text-muted-foreground">
									{isYearly ? "/ year" : "/ month"}
								</span>
							</div>
							{isYearly && (
								<div className="mt-2 font-medium text-emerald-500 text-sm">
									Save 20% &bull; {formatINR(premiumEffectiveMonthlyINR)} /mo
									billed yearly
								</div>
							)}
						</div>

						<ul className="space-y-4 pt-4">
							{premiumFeatures.map((feature, idx) => (
								<li key={idx} className="flex items-start gap-3">
									<Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
									<span className="font-medium text-foreground/90">
										{feature}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
					<CardFooter className="flex-col gap-3">
						<Button
							className="h-14 w-full font-semibold text-lg shadow-lg shadow-primary/25"
							disabled={loadingPlan !== null}
							onClick={() => handleSelectPlan(premiumPriceId, "premium")}
						>
							{loadingPlan === premiumPriceId
								? "Redirecting..."
								: "Select Premium Plan"}
						</Button>
						<div className="flex w-full items-center justify-center gap-1.5 font-medium text-muted-foreground text-xs">
							<Lock className="h-3.5 w-3.5 text-primary/70" />
							Secure checkout by Stripe
						</div>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
