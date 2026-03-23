import { Button } from "@sms/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@sms/ui/components/card";
import { Input } from "@sms/ui/components/input";
import { Label } from "@sms/ui/components/label";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Building2,
	GraduationCap,
	Loader2,
	Plus,
	School as SchoolIcon,
	Stethoscope,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/onboarding/setup")({
	component: SetupOrganization,
});

type BranchContent = {
	id: string;
	name: string;
	type: "school" | "engineering" | "medical" | "arts";
};

const TYPE_ICONS = {
	school: SchoolIcon,
	engineering: Building2,
	medical: Stethoscope,
	arts: GraduationCap,
};

function SetupOrganization() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [institutionId, setInstitutionId] = useState<string | null>(null);
	const [institutionName, setInstitutionName] = useState<string>("");
	const [isLoadingOrg, setIsLoadingOrg] = useState(true);

	// We start with one default branch
	const [branches, setBranches] = useState<BranchContent[]>([
		{ id: crypto.randomUUID(), name: "", type: "school" },
	]);

	// Fetch the user's organization directly from Better-Auth instead of
	// relying on "active org" which requires a separate setActive() call.
	useEffect(() => {
		const loadOrg = async () => {
			try {
				const { data: orgs } = await authClient.organization.list();
				if (orgs && orgs.length > 0) {
					const org = orgs[0];
					setInstitutionId(org.id);
					setInstitutionName(org.name);

					// Also set it as active so session is aware of it
					await authClient.organization.setActive({ organizationId: org.id });
				}
			} catch (e) {
				console.error("Failed to load organization:", e);
			} finally {
				setIsLoadingOrg(false);
			}
		};

		if (session?.user) loadOrg();
		else if (session === null) setIsLoadingOrg(false);
	}, [session]);

	const addBranch = () => {
		setBranches([
			...branches,
			{ id: crypto.randomUUID(), name: "", type: "school" },
		]);
	};

	const removeBranch = (id: string) => {
		if (branches.length === 1) return;
		setBranches(branches.filter((b) => b.id !== id));
	};

	const updateBranch = (
		id: string,
		field: keyof BranchContent,
		value: string,
	) => {
		setBranches(
			branches.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
		);
	};

	const handleSaveAndContinue = async () => {
		if (branches.some((b) => !b.name.trim())) {
			toast.error("Please provide a name for all branches.");
			return;
		}

		if (!institutionId) {
			toast.error("Institution profile not found! Please log in again.");
			return;
		}

		setIsSubmitting(true);
		try {
			await client.onboarding.createCampuses({
				institutionId,
				branches: branches.map((b) => ({ name: b.name, type: b.type })),
			});

			toast.success("Institution branches saved successfully!");
			navigate({ to: "/onboarding/upload" });
		} catch (e: any) {
			toast.error(e.message || "An unexpected error occurred.");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Loading state while fetching org
	if (isLoadingOrg) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="flex flex-col items-center gap-4 text-muted-foreground">
					<Loader2 className="h-10 w-10 animate-spin text-primary" />
					<p className="font-medium text-lg">
						Loading your institution profile...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 pt-10 pb-20">
			<div className="mb-10 space-y-4 pt-10 text-center">
				<h1 className="font-extrabold text-4xl tracking-tight md:text-5xl">
					Define Your <span className="text-primary">Branches</span>
				</h1>
				<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
					{institutionName
						? `Your trust "${institutionName}" has been created. Now add all the individual schools or colleges operating under this trust.`
						: "Let's define all the individual schools or colleges operating under your institution."}
				</p>
			</div>

			<div className="w-full max-w-3xl space-y-6">
				{branches.map((branch, index) => {
					const Icon = TYPE_ICONS[branch.type];
					return (
						<Card
							key={branch.id}
							className="border-border/60 bg-card/60 shadow-sm backdrop-blur transition-all hover:shadow-md"
						>
							<CardHeader className="flex flex-row items-center justify-between pb-4">
								<div className="flex items-center gap-3">
									<div className="rounded-md bg-primary/10 p-2">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<CardTitle className="text-xl">Branch {index + 1}</CardTitle>
								</div>
								{branches.length > 1 && (
									<Button
										variant="ghost"
										size="icon"
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => removeBranch(branch.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
							</CardHeader>
							<CardContent className="grid gap-6 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Branch Type</Label>
									<select
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										value={branch.type}
										onChange={(e) =>
											updateBranch(branch.id, "type", e.target.value)
										}
									>
										<option value="school">K-12 School</option>
										<option value="engineering">Engineering College</option>
										<option value="medical">Medical College</option>
										<option value="arts">Arts &amp; Science College</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label>Branch Name</Label>
									<Input
										placeholder="e.g. Green Valley Secondary School"
										value={branch.name}
										onChange={(e) =>
											updateBranch(branch.id, "name", e.target.value)
										}
									/>
								</div>
							</CardContent>
						</Card>
					);
				})}

				<Button
					variant="outline"
					className="h-14 w-full border-2 border-dashed font-semibold hover:bg-muted/50"
					onClick={addBranch}
				>
					<Plus className="mr-2 h-5 w-5" />
					Add Another Branch
				</Button>

				<div className="flex justify-end pt-8">
					<Button
						size="lg"
						className="h-14 px-8 text-lg shadow-lg"
						onClick={handleSaveAndContinue}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Saving..." : "Save Branches & Continue"}
						<ArrowRight className="ml-2 h-5 w-5" />
					</Button>
				</div>
			</div>
		</div>
	);
}
