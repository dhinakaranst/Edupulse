import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@sms/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@sms/ui/components/card";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/success")({
  component: SuccessPage,
});

function SuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 pt-10 px-4 flex flex-col items-center justify-center max-w-7xl mx-auto">
      <Card className="w-full max-w-md border-border/60 bg-card/60 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="absolute top-0 w-full h-1.5 bg-emerald-500" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground">
            Payment Successful!
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Your subscription is now active.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground space-y-4 pt-2">
            <p>
                Thank you for subscribing. We've emailed you the receipt and 
                all premium features have been unlocked for your institution.
            </p>
        </CardContent>
        <CardFooter className="pt-4 pb-8 flex justify-center">
          <Button
            className="w-full text-lg h-12 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
