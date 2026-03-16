import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@sms/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@sms/ui/components/card";
import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { env } from "@sms/env/web";

export const Route = createFileRoute("/pricing")({
  component: PlanSelection,
});

function PlanSelection() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);

  // Trigger Stripe Checkout
  const handleSelectPlan = async (priceId: string, planType: string) => {
    setLoadingPlan(priceId);
    try {
      toast.info("Preparing secure checkout...", { duration: 3000 });

      toast.info("Preparing secure checkout...", { duration: 3000 });

      // We need to pass the access headers so the backend can verify our session
      const { data: sessionData } = await authClient.getSession();
      
      // Call our backend endpoint to create a Stripe checkout session
      const res = await fetch(`${env.VITE_SERVER_URL}/api/payment/create-checkout-session`, {
        method: "POST",
        credentials: "include", // <--- THIS is required to send Better Auth cookies cross-origin (3001 -> 3000)
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          planType,
          billing: isYearly ? "yearly" : "monthly",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to initiate payment session");
      }

      const data = await res.json();
      const { url } = data;

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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Use valid Stripe Price/Product IDs here from your Stripe Dashboard
  const standardPriceId = isYearly ? "price_1TBUs92LOh90fzBRx5KQzIFc" : "price_1TBUr62LOh90fzBRaB1sniPX";
  const premiumPriceId = isYearly ? "price_1TBUvq2LOh90fzBRkY0OQq6T" : "price_1TBUuj2LOh90fzBRWkJV6wFr";

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
    <div className="min-h-screen pb-20 pt-10 px-4 flex flex-col items-center max-w-7xl mx-auto">
      <div className="text-center space-y-4 mb-10 pt-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
          Select the plan that best fits your institution. Secure payments powered by
          <span className="font-semibold text-foreground inline-flex items-center gap-1 mx-1">
            Stripe
          </span>
        </p>
      </div>

      {/* Monthly/Yearly Toggle */}
      <div className="flex items-center gap-3 mb-10 mx-auto justify-center bg-muted/50 p-1.5 rounded-full border border-border/50">
        <button
          onClick={() => setIsYearly(false)}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
            !isYearly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setIsYearly(true)}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
            isYearly ? "bg-background text-foreground shadow-sm ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          }`}
        >
          Yearly 
          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
            Save 20%
          </span>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto w-full items-stretch">
        
        {/* Standard Plan */}
        <Card className="flex flex-col border-border/60 bg-card/60 backdrop-blur shadow-lg hover:shadow-xl hover:border-border transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Standard</CardTitle>
            <CardDescription className="text-base mt-2">
              Everything you need for small to medium institutions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight">
                  {isYearly ? formatINR(standardYearlyINR) : formatINR(standardMonthlyINR)}
                </span>
                <span className="text-muted-foreground font-medium">
                  {isYearly ? "/ year" : "/ month"}
                </span>
              </div>
              {isYearly && (
                <div className="text-sm font-medium text-emerald-500 mt-2">
                  Save 20% &bull; {formatINR(standardEffectiveMonthlyINR)} /mo billed yearly
                </div>
              )}
            </div>
            
            <ul className="space-y-4 pt-4">
              {standardFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              className="w-full text-lg h-14 font-semibold"
              variant="default"
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan(standardPriceId, "standard")}
            >
              {loadingPlan === standardPriceId ? "Redirecting..." : "Select Plan"}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium w-full justify-center">
              <Lock className="w-3.5 h-3.5" /> 
              Secure checkout by Stripe
            </div>
          </CardFooter>
        </Card>

        {/* Premium Plan */}
        <Card className="flex flex-col border-primary/50 bg-primary/5 backdrop-blur shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all duration-300 relative overflow-hidden ring-1 ring-primary/30 sm:scale-105 z-10">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-bl-xl shadow-sm tracking-wide">
            MOST POPULAR
          </div>
          <CardHeader>
            <CardTitle className="text-3xl font-bold flex items-center gap-3">
              Premium 
            </CardTitle>
            <CardDescription className="text-base mt-2 font-medium text-foreground/80">
              The ultimate solution for enterprise scaling and intelligence.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-primary">
                  {isYearly ? formatINR(premiumYearlyINR) : formatINR(premiumMonthlyINR)}
                </span>
                <span className="text-muted-foreground font-medium">
                  {isYearly ? "/ year" : "/ month"}
                </span>
              </div>
              {isYearly && (
                <div className="text-sm font-medium text-emerald-500 mt-2">
                  Save 20% &bull; {formatINR(premiumEffectiveMonthlyINR)} /mo billed yearly
                </div>
              )}
            </div>

            <ul className="space-y-4 pt-4">
              {premiumFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground/90">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              className="w-full text-lg h-14 font-semibold shadow-lg shadow-primary/25"
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan(premiumPriceId, "premium")}
            >
              {loadingPlan === premiumPriceId ? "Redirecting..." : "Select Premium Plan"}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium w-full justify-center">
              <Lock className="w-3.5 h-3.5 text-primary/70" /> 
              Secure checkout by Stripe
            </div>
          </CardFooter>
        </Card>

      </div>
    </div>
  );
}





