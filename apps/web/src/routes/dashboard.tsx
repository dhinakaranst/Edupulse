import { env } from "@sms/env/web";
import { Button } from "@sms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@sms/ui/components/card";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useChildMatches,
	useNavigate,
} from "@tanstack/react-router";
import {
	Building2,
	ChevronRight,
	Clock,
	Download,
	ExternalLink,
	GraduationCap,
	LayoutDashboard,
	Loader2,
	Plus,
	ShieldCheck,
	Upload,
	Users,
	BookOpen,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard")({
	component: InstitutionAdminDashboard,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}

		// Force password change check
		// @ts-expect-error
		if (session.data.user.hasChangedPassword === false) {
			redirect({
				to: "/change-password",
				throw: true,
			});
		}

		return { session };
	},
});

function InstitutionAdminDashboard() {
	const childMatches = useChildMatches();

	// If a child route is active (e.g. /dashboard/branch/$branchId), render it directly
	if (childMatches.length > 0) {
		return <Outlet />;
	}

	return <DashboardContent />;
}

function DashboardContent() {
	const { session } = Route.useRouteContext();
	const [dashboardData, setDashboardData] = useState<any>(null);
	const [membersList, setMembersList] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [institutionId, setInstitutionId] = useState<string | null>(null);

	// ── 2. Fetch Dashboard Data ────────────────────────────────────────────────────
	const fetchDashboard = useCallback(async (id: string) => {
		try {
			// Get basic dashboard to identify role
			const mainDashboard = await client.onboarding.getDashboard({ institutionId: id });

			if (mainDashboard.institution.role === "student") {
				// Stop and fetch student-specific data
				const [studentData, attendanceStats] = await Promise.all([
					client.student.getDashboard({ institutionId: id }),
					client.attendance.getStudentStats(),
				]);

				setDashboardData({
					isStudent: true,
					studentData: studentData,
					attendanceStats: attendanceStats,
					institution: mainDashboard.institution,
				});
				return;
			}

			// Normal staff/admin flow
			const membersRes = await client.onboarding.getMembers({ institutionId: id });
			
			setDashboardData({
				isStudent: false,
				institution: mainDashboard.institution,
				stats: mainDashboard.stats,
				campuses: mainDashboard.campuses,
			});
			setMembersList(membersRes.members);
		} catch (e) {
			console.error("Failed to load dashboard data:", e);
			toast.error("Failed to load dashboard data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// ── 1. Determine Institution Context ───────────────────────────────────────────
	useEffect(() => {
		const fetchOrg = async () => {
			try {
				// First check session for active org
				let orgId = session.data?.session?.activeOrganizationId;

				// If not set, fetch list and take first (since this is the Trust Admin)
				if (!orgId) {
					const { data: orgs } = await authClient.organization.list();
					if (orgs && orgs.length > 0) {
						orgId = orgs[0].id;
						// Set it as active for future requests
						await authClient.organization.setActive({ organizationId: orgId });
					}
				}

				if (orgId) {
					setInstitutionId(orgId);
					fetchDashboard(orgId);
				} else {
					setIsLoading(false);
				}
			} catch (err) {
				console.error("Dashboard: Error fetching org context", err);
				setIsLoading(false);
			}
		};

		fetchOrg();
	}, [session, fetchDashboard]);

	const navigate = useNavigate();

	// Check if we should redirect to onboarding
	useEffect(() => {
		if (
			!isLoading &&
			dashboardData &&
			!dashboardData.isStudent &&
			dashboardData.campuses &&
			dashboardData.campuses.length === 0 &&
			institutionId
		) {
			// If we have an institution but no branches, they probably haven't finished setup
			navigate({ to: "/onboarding/setup" });
		}
	}, [isLoading, dashboardData, institutionId, navigate]);

	const [isDownloading, setIsDownloading] = useState(false);
	const handleDownloadTemplate = async () => {
		if (!institutionId) return;
		setIsDownloading(true);
		try {
			const res = await fetch(
				`${env.VITE_SERVER_URL}/api/onboarding/template/download?institutionId=${institutionId}`,
				{
					credentials: "include",
				},
			);
			if (!res.ok) throw new Error("Failed to download template");

			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "edupulse-setup-template.xlsx";
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
			toast.success("Template downloaded successfully");
		} catch (err) {
			console.error(err);
			toast.error("Failed to download template. Please try again.");
		} finally {
			setIsDownloading(false);
		}
	};

	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file || !institutionId) return;

		setIsUploading(true);
		const formData = new FormData();
		formData.append("file", file);
		formData.append("institutionId", institutionId);

		try {
			const _data = await client.onboarding.uploadTemplate({
				file,
				institutionId,
			});

			toast.success("Structure and users created successfully!");
			// Reset the file input
			if (fileInputRef.current) fileInputRef.current.value = "";

			// Refresh the dashboard stats
			fetchDashboard(institutionId);
		} catch (err: any) {
			console.error(err);
			toast.error(err.message || "Failed to process the uploaded file.");
		} finally {
			setIsUploading(false);
		}
	};

	if (isLoading)
		return (
			<div className="flex flex-1 items-center justify-center">
				<Loader />
			</div>
		);

	if (!institutionId || !dashboardData) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center space-y-4 p-8 text-center">
				<Building2 className="h-16 w-16 text-muted-foreground opacity-20" />
				<h2 className="font-bold text-2xl text-muted-foreground uppercase italic">
					No Institution Found
				</h2>
				<p className="max-w-md text-muted-foreground italic">
					You don't seem to be associated with an institution yet. Please
					complete your registration.
				</p>
				<Button onClick={() => (window.location.href = "/register")}>
					Finish Registration
				</Button>
			</div>
		);
	}

	// ── Hand off to Student View if applicable ──
	if (dashboardData.isStudent) {
		return <StudentDashboard data={dashboardData} />;
	}

	const { stats, campuses, institution } = dashboardData;

	return (
		<div className="flex-1 overflow-y-auto bg-[#fafafa] p-6 lg:p-10 dark:bg-[#09090b]">
			<div className="mx-auto max-w-7xl space-y-10">
				{/* ── Header & Info ── */}
				<div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
					<div className="space-y-2">
						<div className="flex items-center gap-2 font-bold text-primary text-xs uppercase tracking-tight">
							<LayoutDashboard className="h-4 w-4" />
							{institution.role === "owner"
								? "Main Controller"
								: `${institution.role} Portal`}
						</div>
						<h1 className="font-extrabold text-4xl tracking-tight lg:text-5xl">
							{institution.name}
						</h1>
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-bold text-primary">
								<ShieldCheck className="h-3.5 w-3.5" />
								{institution.plan} Plan
							</span>
							<span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-bold text-emerald-500">
								● {institution.status}
							</span>
							<span className="text-muted-foreground">
								• Admin: {session.data?.user.name}
							</span>
						</div>
					</div>

					{institution.role === "owner" && (
						<div className="flex gap-3">
							<Button
								variant="outline"
								className="h-11 font-semibold shadow-sm"
								onClick={() => toast.info("Profile editing coming soon!")}
							>
								Edit Profile
							</Button>
							<Button
								className="h-11 px-6 font-bold shadow-lg shadow-primary/20"
								onClick={() =>
									toast.info(
										"Manual branch creation coming soon! Use bulk upload.",
									)
								}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Branch
							</Button>
						</div>
					)}
				</div>

				{/* ── Stats Summary ── */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
					<StatCard
						icon={Building2}
						label="Total Branches"
						value={stats.branches}
						color="text-indigo-500"
					/>
					<StatCard
						icon={Users}
						label="Total Staff Members"
						value={stats.staff}
						color="text-sky-500"
					/>
					<StatCard
						icon={GraduationCap}
						label="Total Students"
						value={stats.students}
						color="text-violet-500"
					/>
					<StatCard
						icon={Clock}
						label="System Status"
						value="Healthy"
						color="text-emerald-500"
						isStatus
					/>
				</div>

				<div className="grid grid-cols-1 gap-8 pt-4 lg:grid-cols-3">
					{/* ── Branches List (Left 2/3) ── */}
					<div className="space-y-6 lg:col-span-2">
						<div className="flex items-center justify-between">
							<h2 className="px-1 font-bold text-2xl tracking-tight">
								Active Branches
							</h2>
							<Button
								variant="link"
								className="font-bold text-primary text-sm"
								onClick={() => toast.info("View All branches coming soon!")}
							>
								View All <ChevronRight className="ml-0.5 h-4 w-4" />
							</Button>
						</div>

						<div className="grid grid-cols-1 gap-5 md:grid-cols-2">
							{campuses.map((campus: any) => (
								<Card
									key={campus.id}
									className="group overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-primary/5 hover:shadow-xl"
								>
									<CardHeader className="pb-4">
										<div className="flex items-start justify-between">
											<div className="rounded-xl bg-primary/5 p-3 transition-colors group-hover:bg-primary/10">
												<CampusIcon type={campus.type} />
											</div>
											<span className="rounded border border-muted-foreground/20 px-1.5 py-0.5 font-black text-[10px] text-muted-foreground/50 uppercase tracking-widest">
												{campus.type}
											</span>
										</div>
										<CardTitle className="mt-4 text-xl transition-colors group-hover:text-primary">
											{campus.name}
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4 pb-6">
										<div className="flex flex-col gap-2.5 text-muted-foreground text-sm">
											<div className="flex items-center gap-2">
												<LayoutDashboard className="h-4 w-4 opacity-70" />
												<span>{campus.deptCount} Departments</span>
											</div>
											<div className="flex items-center gap-2">
												<Users className="h-4 w-4 opacity-70" />
												<span>{campus.staffCount} Staff Members</span>
											</div>
										</div>
									</CardContent>
									<CardFooter className="border-border/10 border-t bg-muted/20 px-6 py-4 pt-0">
										<Button
											variant="ghost"
											className="w-full p-0 font-black text-xs uppercase tracking-widest transition-all hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
										>
											<Link
												to="/dashboard/branch/$branchId"
												params={{ branchId: campus.id }}
												className="flex h-full w-full items-center justify-center gap-2"
											>
												Open Management Dash{" "}
												<ExternalLink className="h-3 w-3" />
											</Link>
										</Button>
									</CardFooter>
								</Card>
							))}
						</div>
					</div>

					{/* ── Setup Flow (Right 1/3) ── */}
					{institution.role === "owner" && (
						<div className="space-y-6">
							<h2 className="px-1 font-bold text-2xl italic tracking-tight">
								Quick Setup
							</h2>
							<Card className="relative overflow-hidden border-2 border-primary/20 border-dashed bg-primary/5 shadow-none">
								<div className="absolute top-0 right-0 p-4 opacity-10">
									<ShieldCheck className="h-24 w-24" />
								</div>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg">Bulk Import Members</CardTitle>
									<CardDescription className="text-xs">
										Perfect for large institutions. Set up your whole structure
										in minutes.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4 pt-4">
									<div className="space-y-3">
										<Button
											variant="outline"
											className="h-12 w-full border-primary/10 bg-background font-bold text-sm shadow-sm hover:border-primary/50"
											onClick={handleDownloadTemplate}
											disabled={isDownloading}
										>
											{isDownloading ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Download className="mr-2 h-4 w-4 text-primary" />
											)}
											Get Setup Excel
										</Button>
										<input
											type="file"
											accept=".xlsx"
											className="hidden"
											ref={fileInputRef}
											onChange={handleFileUpload}
										/>
										<Button
											className="h-12 w-full font-bold shadow-md shadow-primary/20"
											onClick={() => fileInputRef.current?.click()}
											disabled={isUploading || isDownloading}
										>
											{isUploading ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Upload className="mr-2 h-4 w-4" />
											)}
											{isUploading ? "Processing..." : "Upload Filled Sheets"}
										</Button>
									</div>

									<div className="space-y-2 rounded-lg border border-primary/5 bg-background/50 p-4">
										<div className="font-black text-[10px] text-primary/60 uppercase">
											Guide: 2 Easy Steps
										</div>
										<p className="text-[10px] text-muted-foreground italic leading-relaxed">
											1. Fill the **structure** sheet with campus
											depts/sections.
											<br />
											2. Fill the **people** sheet with staff/head emails.
										</p>
									</div>
								</CardContent>
							</Card>

							<Card className="border-border/50 bg-card/40 backdrop-blur-sm">
								<CardHeader className="pb-2">
									<CardTitle className="font-black text-[13px] uppercase tracking-widest">
										Recent Activity
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-5 pt-4">
									<ActivityItem
										icon={Building2}
										title="Branches Created"
										desc={`Linked ${campuses.length} branches to your account.`}
										time="Just now"
									/>
									<ActivityItem
										icon={ShieldCheck}
										title="Subscription Active"
										desc="Standard Plan activated via Stripe."
										time="10 mins ago"
									/>
								</CardContent>
							</Card>
						</div>
					)}
				</div>

				{/* Staff Table */}
				<div className="mt-8">
					<Card className="border-border/50 bg-card/40 backdrop-blur-sm">
						<CardHeader className="flex flex-row items-center justify-between pb-4">
							<div>
								<CardTitle className="font-bold text-xl">
									Staff Directory
								</CardTitle>
								<CardDescription>
									Verified members added via bulk upload
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => toast.info("Full management coming soon!")}
							>
								Manage All
							</Button>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="border-border/50 border-b font-black text-[10px] text-muted-foreground uppercase tracking-widest">
										<tr>
											<th className="px-1 pb-3">Name</th>
											<th className="px-1 pb-3">Email</th>
											<th className="px-1 pb-3">Branch</th>
											<th className="px-1 pb-3">Role</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/20">
										{membersList.length > 0 ? (
											membersList.map((member: any) => (
												<tr
													key={member.id}
													className="group transition-colors hover:bg-primary/5"
												>
													<td className="px-1 py-4 font-semibold">
														{member.name}
													</td>
													<td className="px-1 py-4 text-muted-foreground">
														{member.email}
													</td>
													<td className="px-1 py-4">
														<div className="flex items-center gap-1.5">
															<Building2 className="h-3 w-3 text-primary/60" />
															{member.campus || "Institution"}
														</div>
													</td>
													<td className="px-1 py-4 font-black text-[10px] uppercase">
														<span className="rounded bg-primary/10 px-2 py-1 text-primary">
															{member.role}
														</span>
													</td>
												</tr>
											))
										) : (
											<tr>
												<td
													colSpan={4}
													className="py-8 text-center text-muted-foreground italic"
												>
													No staff members added yet. Use the Quick Setup to
													import.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, isStatus = false }: any) {
	return (
		<Card className="cursor-default border-border/50 bg-card/60 shadow-sm backdrop-blur transition-all hover:scale-[1.02] hover:shadow-md">
			<CardContent className="p-6">
				<div className="flex items-center gap-4">
					<div className={`rounded-2xl bg-muted/50 p-3 ${color}`}>
						<Icon className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<p className="font-black text-[10px] text-muted-foreground/70 uppercase tracking-widest">
							{label}
						</p>
						<h3 className="font-black text-3xl tabular-nums tracking-tighter">
							{isStatus ? (
								<span className="text-emerald-500 text-lg uppercase">
									{value}
								</span>
							) : (
								value
							)}
						</h3>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function CampusIcon({ type }: { type: string }) {
	if (type === "medical")
		return <GraduationCap className="h-6 w-6 text-primary" />;
	if (type === "engineering")
		return <Building2 className="h-6 w-6 text-primary" />;
	return <Building2 className="h-6 w-6 text-primary" />;
}

function ActivityItem({ icon: Icon, title, desc, time }: any) {
	return (
		<div className="group flex gap-4">
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 transition-colors group-hover:bg-primary/20">
				<Icon className="h-4 w-4 text-primary" />
			</div>
			<div className="min-w-0 space-y-0.5">
				<div className="truncate font-bold text-xs">{title}</div>
				<div className="line-clamp-1 text-[10px] text-muted-foreground">
					{desc}
				</div>
				<div className="mt-1 font-black text-[9px] text-muted-foreground/40 uppercase tracking-widest">
					{time}
				</div>
			</div>
		</div>
	);
}

// ── Student Dashboard View ───────────────────────────────────────────────────

function StudentDashboard({ data }: { data: any }) {
	const { studentData, institution } = data;
	const { profile, branch, department, section } = studentData;
	const { session } = Route.useRouteContext();

	return (
		<div className="flex-1 overflow-y-auto bg-[#fafafa] p-6 lg:p-10 dark:bg-[#09090b]">
			<div className="mx-auto max-w-5xl space-y-8">
				{/* ── Welcome Banner ── */}
				<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2 font-bold text-primary text-xs uppercase tracking-tight">
							<GraduationCap className="h-4 w-4" />
							Student Portal
						</div>
						<h1 className="font-extrabold text-4xl tracking-tight lg:text-5xl">
							Welcome back, {session.data?.user.name?.split(" ")[0]}!
						</h1>
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<span className="flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 font-bold text-sky-500">
								<BookOpen className="h-3.5 w-3.5" />
								{department?.name || "Enrolled"}
							</span>
							<span className="text-muted-foreground">
								• {institution.name}
							</span>
						</div>
					</div>
					<div>
						<Button className="h-11 shadow-lg shadow-primary/20" onClick={() => toast.info("Your academic profile will appear here soon!")}>
							View Full Profile
						</Button>
					</div>
				</div>

				{/* ── Quick Stats/Info ── */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
					<StatCard
						icon={BookOpen}
						label="Roll Number"
						value={profile?.rollNumber || "N/A"}
						color="text-indigo-500"
					/>
					<StatCard
						icon={Building2}
						label="Branch/Campus"
						value={branch?.name || "N/A"}
						color="text-violet-500"
						isStatus={true}
					/>
					<StatCard
						icon={Users}
						label="Section"
						value={section?.name || "General"}
						color="text-emerald-500"
						isStatus={true}
					/>
					<StatCard
						icon={Clock}
						label="Attendance"
						value={data.attendanceStats?.percentage !== null ? `${data.attendanceStats.percentage}%` : "100%"}
						color={data.attendanceStats?.percentage !== null && data.attendanceStats.percentage < 75 ? "text-destructive" : "text-sky-500"}
						isStatus={true}
					/>
				</div>

				{/* ── Announcements Placeholder ── */}
				<Card className="border-border/50 bg-card/40 backdrop-blur-sm">
					<CardHeader>
						<CardTitle className="font-bold text-xl">Recent Announcements</CardTitle>
						<CardDescription>Updates from your department and institution</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col items-center justify-center space-y-4 py-12 text-center text-muted-foreground">
							<ShieldCheck className="h-12 w-12 opacity-20" />
							<p className="italic">You're all caught up! No new announcements.</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
