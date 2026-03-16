import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({
		showSignUp: z.boolean().optional(),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { showSignUp } = Route.useSearch();
	const [showSignIn, setShowSignIn] = useState(!showSignUp);

	return showSignIn ? (
		<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
	) : (
		<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
	);
}
