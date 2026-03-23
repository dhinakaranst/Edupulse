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
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Building2,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Download,
	ExternalLink,
	GraduationCap,
	LayoutDashboard,
	Loader2,
	Plus,
	ShieldCheck,
	Upload,
	Users,
	UserCheck,
	Calendar as CalendarIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/loader";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/branch/$branchId")({
	component: BranchManagementDashboard,
});

function BranchManagementDashboard() {
	const { branchId } = Route.useParams();
	const [data, setData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isUploading, setIsUploading] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [studentsList, setStudentsList] = useState<any[]>([]);

	// ── Form States for Management ──
	const [newDeptName, setNewDeptName] = useState("");
	const [isAddingDept, setIsAddingDept] = useState(false);
	const [showAddDept, setShowAddDept] = useState(false);

	// ── Attendance Panel State ──
	const [activeAttendanceSection, setActiveAttendanceSection] = useState<{deptId: string; deptName: string; section: any} | null>(null);

	const fetchDetails = useCallback(async () => {
		try {
			const [statsRes, studentsRes] = await Promise.all([
				client.management.getBranchDashboardStats({ branchId }),
				client.management.getBranchStudents({ branchId }),
			]);
			setData(statsRes);
			setStudentsList(studentsRes.students);
		} catch (err: any) {
			toast.error(err.message || "Failed to load management dashboard");
		} finally {
			setIsLoading(false);
		}
	}, [branchId]);

	useEffect(() => {
		fetchDetails();
	}, [fetchDetails]);

	const handleAddDepartment = async () => {
		if (!newDeptName.trim()) {
			toast.error("Department name cannot be empty");
			return;
		}
		setIsAddingDept(true);
		try {
			await client.management.createDepartment({
				branchId,
				name: newDeptName.trim(),
			});
			toast.success("Department created successfully!");
			setNewDeptName("");
			setShowAddDept(false);
			fetchDetails();
		} catch (err: any) {
			toast.error(err.message || "Failed to create department");
		} finally {
			setIsAddingDept(false);
		}
	};

	const [newSectionNames, setNewSectionNames] = useState<Record<string, string>>({});
	const [showAddSection, setShowAddSection] = useState<Record<string, boolean>>({});
	const [isAddingSection, setIsAddingSection] = useState<Record<string, boolean>>({});

	const handleAddSection = async (deptId: string) => {
		const name = newSectionNames[deptId]?.trim();
		if (!name) return;

		setIsAddingSection(prev => ({ ...prev, [deptId]: true }));
		try {
			await client.management.createSection({
				departmentId: deptId,
				name
			});
			toast.success("Section added!");
			setNewSectionNames(prev => ({ ...prev, [deptId]: "" }));
			setShowAddSection(prev => ({ ...prev, [deptId]: false }));
			fetchDetails();
		} catch (err: any) {
			toast.error(err.message || "Failed to add section");
		} finally {
			setIsAddingSection(prev => ({ ...prev, [deptId]: false }));
		}
	};

	// ── Download branch-specific student template ──────────────────────────────
	const handleDownloadTemplate = async () => {
		setIsDownloading(true);
		try {
			// Use the dedicated Hono GET route (not oRPC) so binary xlsx is served correctly.
			const res = await fetch(
				`${env.VITE_SERVER_URL}/api/students/template/download?branchId=${branchId}`,
				{
					credentials: "include",
				},
			);

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err?.message || "Failed to download template");
			}

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download =
				`${data?.branch?.name ?? "branch"}_students_template.xlsx`.replace(
					/\s+/g,
					"_",
				);
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			toast.success(
				"Template downloaded! Fill in the 'students' sheet, then upload.",
			);
		} catch (err: any) {
			toast.error(err.message || "Download failed");
		} finally {
			setIsDownloading(false);
		}
	};

	// ── Upload filled Excel and enroll students ────────────────────────────────
	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setIsUploading(true);

		const uploadToastId = toast.loading(
			"Processing student Excel… Please wait.",
		);

		try {
			const result = await client.management.uploadBranchStudents({
				branchId,
				file,
			});

			toast.dismiss(uploadToastId);

			if (result.skipped === 0) {
				toast.success(
					`✅ Enrollment complete! ${result.added} student${result.added !== 1 ? "s" : ""} added. Welcome emails sent.`,
					{ duration: 6000 },
				);
			} else {
				toast.warning(
					`⚠️ Done: ${result.added} added, ${result.skipped} skipped.\n${result.errors.slice(0, 3).join("\n")}`,
					{ duration: 8000 },
				);
			}

			// Refresh stats
			fetchDetails();
		} catch (err: any) {
			toast.dismiss(uploadToastId);
			toast.error(
				err.message || "Upload failed. Please check the file and try again.",
			);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	if (isLoading) return <Loader />;

	if (!data) {
		return (
			<div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
				<Building2 className="h-16 w-16 text-muted-foreground opacity-20" />
				<h2 className="font-bold text-2xl text-muted-foreground uppercase italic">
					Access Denied or Not Found
				</h2>
				<Link to="/dashboard">
					<Button variant="outline">Back to Dashboard</Button>
				</Link>
			</div>
		);
	}

	const { branch, role, departments, stats } = data;

	return (
		<div className="flex-1 overflow-y-auto bg-[#fafafa] p-6 lg:p-10 dark:bg-[#09090b]">
			<div className="mx-auto max-w-7xl space-y-10">
				{/* Header */}
				<div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
					<div className="space-y-4">
						<Link
							to="/dashboard"
							className="inline-flex items-center font-black text-[10px] text-primary uppercase tracking-widest transition-all hover:gap-2"
						>
							<ChevronLeft className="mr-1 h-3 w-3" /> Return to Trust
							Controller
						</Link>
						<div className="space-y-1">
							<div className="flex items-center gap-2 font-bold text-primary text-xs uppercase tracking-tight">
								<ShieldCheck className="h-4 w-4" />
								{role === "principal"
									? "Branch Principal"
									: `Advisor: ${departments[0]?.name}`}
							</div>
							<h1 className="flex items-center gap-4 font-extrabold text-4xl tracking-tight lg:text-6xl">
								{branch.name}
							</h1>
							<p className="font-medium text-muted-foreground italic">
								Comprehensive academic &amp; staff operations portal
							</p>
						</div>
					</div>

					<div className="flex gap-3">
						<Button
							variant="outline"
							className="h-12 border-border/50 font-bold text-[10px] uppercase tracking-widest shadow-sm"
						>
							Settings
						</Button>
						{/* Hidden file input */}
						<input
							type="file"
							accept=".xlsx"
							className="hidden"
							ref={fileInputRef}
							onChange={handleFileUpload}
						/>
						<Button
							className="h-12 px-8 font-bold shadow-lg shadow-primary/20"
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading}
						>
							{isUploading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Upload className="mr-2 h-4 w-4" />
							)}
							{isUploading ? "Enrolling…" : "Enroll Students"}
						</Button>
					</div>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
					<ManagementStatCard
						icon={LayoutDashboard}
						label="Departments"
						value={stats.departments}
						color="text-indigo-500"
					/>
					<ManagementStatCard
						icon={Users}
						label="Verified Staff"
						value="--"
						color="text-sky-500"
					/>
					<ManagementStatCard
						icon={GraduationCap}
						label="Students"
						value={stats.students}
						color="text-violet-500"
					/>
					<ManagementStatCard
						icon={CheckCircle2}
						label="Health Score"
						value="98%"
						color="text-emerald-500"
					/>
				</div>

				{/* Content Area */}
				<div className="grid grid-cols-1 gap-10 pt-4 lg:grid-cols-3">
					{/* Left: Department Cards */}
					<div className="space-y-8 lg:col-span-2">
						<div className="flex items-center justify-between border-b pb-4">
							<h2 className="font-bold text-2xl tracking-tight">
								{role === "principal" ? "Branch Structure" : "Your Department"}
							</h2>
							{role === "principal" && (
								<div className="flex items-center gap-2">
									{showAddDept ? (
										<div className="flex items-center gap-2">
											<input
												type="text"
												value={newDeptName}
												onChange={(e) => setNewDeptName(e.target.value)}
												placeholder="E.g. Computer Science"
												className="h-8 rounded-md border border-input bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
												autoFocus
												onKeyDown={(e) => {
													if (e.key === 'Enter') handleAddDepartment();
													if (e.key === 'Escape') setShowAddDept(false);
												}}
											/>
											<Button
												size="sm"
												className="h-8 shadow-sm"
												onClick={handleAddDepartment}
												disabled={isAddingDept}
											>
												{isAddingDept ? <Loader2 className="h-3 w-3 animate-spin mx-2" /> : "Save"}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 px-2 text-muted-foreground"
												onClick={() => setShowAddDept(false)}
												disabled={isAddingDept}
											>
												Cancel
											</Button>
										</div>
									) : (
										<Button
											variant="outline"
											size="sm"
											className="font-bold text-primary text-xs shadow-sm border-primary/20"
											onClick={() => setShowAddDept(true)}
										>
											<Plus className="mr-1 h-3 w-3" /> Add Dept
										</Button>
									)}
								</div>
							)}
						</div>

						{departments.length === 0 && !showAddDept && (
							<div className="rounded-xl border border-dashed border-border/60 bg-card/20 p-8 text-center text-muted-foreground italic">
								No departments exist yet. Use the bulk upload or the Add Dept button to create one.
							</div>
						)}

						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							{departments.map((dept: any) => (
								<Card
									key={dept.id}
									className="group overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-primary/5 hover:shadow-xl"
								>
									<CardHeader className="pb-4">
										<div className="flex items-start justify-between">
											<div className="rounded-xl bg-primary/5 p-3 transition-colors group-hover:bg-primary/10">
												<LayoutDashboard className="h-5 w-5 text-primary" />
											</div>
											<span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-black text-[9px] text-emerald-500 uppercase tracking-widest">
												Active
											</span>
										</div>
										<CardTitle className="mt-4 text-xl transition-colors group-hover:text-primary">
											{dept.name}
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4 text-muted-foreground text-sm flex-1">
										{/* Render sections block */}
										<div>
											<div className="font-bold text-[10px] uppercase tracking-widest text-primary/60 mb-2">
												Sections ({dept.sections?.length || 0})
											</div>
											<div className="flex flex-wrap gap-2">
												{dept.sections?.map((sec: any) => (
													<button
														key={sec.id}
														onClick={() => setActiveAttendanceSection({ deptId: dept.id, deptName: dept.name, section: sec })}
														className={`rounded border px-2 py-0.5 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
															activeAttendanceSection?.section.id === sec.id
																? "bg-primary text-primary-foreground border-primary"
																: "bg-background text-foreground border-primary/20 hover:bg-primary/5 cursor-pointer"
														}`}
														title="Click to manage attendance"
													>
														{sec.name}
													</button>
												))}
												
												{showAddSection[dept.id] ? (
													<div className="flex items-center gap-1 w-full mt-1">
														<input
															type="text"
															value={newSectionNames[dept.id] || ""}
															onChange={(e) => setNewSectionNames(prev => ({ ...prev, [dept.id]: e.target.value }))}
															placeholder="e.g. A"
															className="h-6 w-full rounded border border-input bg-background px-2 text-[10px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
															autoFocus
															onKeyDown={(e) => {
																if (e.key === 'Enter') handleAddSection(dept.id);
																if (e.key === 'Escape') setShowAddSection(prev => ({ ...prev, [dept.id]: false }));
															}}
														/>
														<Button
															size="sm"
															className="h-6 px-2 text-[10px] shadow-sm min-w-10"
															onClick={() => handleAddSection(dept.id)}
															disabled={isAddingSection[dept.id]}
														>
															{isAddingSection[dept.id] ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Add"}
														</Button>
													</div>
												) : (
													<button
														onClick={() => setShowAddSection(prev => ({ ...prev, [dept.id]: true }))}
														className="rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 hover:border-primary/60 flex items-center justify-center cursor-pointer"
													>
														<Plus className="h-3 w-3" />
													</button>
												)}
											</div>
										</div>
									</CardContent>
									<CardFooter className="border-border/5 border-t bg-muted/20 px-6 py-4 pt-0">
										<Button
											variant="ghost"
											className="h-8 w-full p-0 font-black text-[10px] uppercase tracking-widest hover:text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground mt-4"
											onClick={() => {
												setShowAddSection(prev => ({ ...prev, [dept.id]: true }));
											}}
										>
											Manage Sections{" "}
											<ExternalLink className="ml-2 h-3 w-3" />
										</Button>
									</CardFooter>
								</Card>
							))}
						</div>
					</div>

					{/* Right: Enrollment Card OR Attendance Panel */}
					<div className="space-y-8">
						{activeAttendanceSection ? (
							<AttendancePanel
								activeData={activeAttendanceSection}
								onClose={() => setActiveAttendanceSection(null)}
								refreshStats={fetchDetails}
							/>
						) : (
							<>
								<Card className="relative overflow-hidden border-2 border-primary/20 border-dashed bg-primary/5">
									<CardHeader className="pb-2">
										<CardTitle className="text-lg">Student Enrollment</CardTitle>
										<CardDescription>
											Download the template, fill in student details, then upload to
											bulk enroll.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4 pt-4">
										{/* Template download */}
										<Button
											variant="outline"
											className="h-12 w-full border-primary/10 bg-background font-bold hover:border-primary/40"
											onClick={handleDownloadTemplate}
											disabled={isDownloading}
										>
											{isDownloading ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Download className="mr-2 h-4 w-4" />
											)}
											{isDownloading ? "Preparing…" : "Get Student Excel"}
										</Button>

										<div className="rounded-xl border border-primary/10 bg-background/50 p-4">
											<h4 className="mb-2 font-black text-[10px] text-primary uppercase tracking-widest">
												Instructions
											</h4>
											<ul className="space-y-2 text-[10px] text-muted-foreground italic leading-relaxed">
												<li>• Download the Excel template above</li>
												<li>
													• Check the <strong>reference</strong> sheet for valid
													dept/section names
												</li>
												<li>
													• Fill the <strong>students</strong> sheet (name, email,
													dept, section, roll no.)
												</li>
												<li>
													• Click <strong>Enroll Students</strong> to upload &amp;
													trigger welcome emails
												</li>
											</ul>
										</div>

										{/* Upload shortcut inside card too */}
										<Button
											className="h-12 w-full font-bold shadow-md shadow-primary/10"
											onClick={() => fileInputRef.current?.click()}
											disabled={isUploading}
										>
											{isUploading ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Upload className="mr-2 h-4 w-4" />
											)}
											{isUploading ? "Enrolling…" : "Upload Filled Excel"}
										</Button>
									</CardContent>
								</Card>

								<Card className="border-border/50 bg-card/40">
									<CardHeader className="pb-2">
										<CardTitle className="font-black text-[11px] uppercase tracking-[0.2em]">
											Recent Events
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-6 pt-4">
										<EventItem
											icon={Users}
											title="Staff Sync"
											desc="6 staff members linked to this branch."
											time="1h ago"
										/>
										<EventItem
											icon={ShieldCheck}
											title="Access Granted"
											desc="Advisor assigned to CS Department."
											time="2h ago"
										/>
									</CardContent>
								</Card>
							</>
						)}
					</div>
				</div>

				{/* ── Student Directory Table ── */}
				<div className="pt-8 w-full">
					<Card className="border-border/50 bg-card/40 backdrop-blur-sm">
						<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6">
							<div>
								<CardTitle className="font-bold text-2xl tracking-tight">
									Student Directory
								</CardTitle>
								<CardDescription className="italic">
									All verified students enrolled in this branch
								</CardDescription>
							</div>
							<div className="flex items-center gap-3">
								<Button variant="outline" size="sm" className="h-9 font-bold" onClick={() => toast.info('Filter options coming soon!')}>
									Filter List
								</Button>
								<Button size="sm" className="h-9 font-bold" onClick={() => fileInputRef.current?.click()}>
									<Plus className="mr-2 h-4 w-4" /> Add More
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="border-border/50 border-b font-black text-[10px] text-muted-foreground uppercase tracking-widest">
										<tr>
											<th className="px-4 pb-4">Student Info</th>
											<th className="px-4 pb-4">Roll Number</th>
											<th className="px-4 pb-4">Department</th>
											<th className="px-4 pb-4">Section</th>
											<th className="px-4 pb-4 text-right">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/20">
										{studentsList.length > 0 ? (
											studentsList.map((student: any) => (
												<tr
													key={student.id}
													className="group transition-colors hover:bg-primary/5"
												>
													<td className="px-4 py-4">
														<div className="flex flex-col">
															<span className="font-bold">{student.name}</span>
															<span className="text-muted-foreground text-[11px] font-medium">{student.email}</span>
														</div>
													</td>
													<td className="px-4 py-4 font-mono font-bold text-xs">
														{student.rollNumber || "N/A"}
													</td>
													<td className="px-4 py-4 font-bold text-xs uppercase tracking-tight">
														{student.departmentName ? (
															<span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-500">
																{student.departmentName}
															</span>
														) : (
															<span className="text-muted-foreground opacity-50">None</span>
														)}
													</td>
													<td className="px-4 py-4 font-bold text-xs">
														{student.sectionName ? (
															<span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-500">
																Sec. {student.sectionName}
															</span>
														) : (
															<span className="text-muted-foreground opacity-50">-</span>
														)}
													</td>
													<td className="px-4 py-4 text-right">
														<Button variant="ghost" size="sm" className="h-8 text-xs font-bold transition-opacity lg:opacity-0 lg:group-hover:opacity-100" onClick={() => toast.info('Detailed profile view coming soon!')}>
															View Details <ChevronRight className="ml-1 h-3 w-3" />
														</Button>
													</td>
												</tr>
											))
										) : (
											<tr>
												<td
													colSpan={5}
													className="py-12 text-center text-muted-foreground italic"
												>
													<div className="flex flex-col items-center justify-center space-y-3">
														<Users className="h-10 w-10 opacity-20" />
														<p>No students enrolled yet. Upload the Excel file to get started.</p>
													</div>
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

function ManagementStatCard({ icon: Icon, label, value, color }: any) {
	return (
		<Card className="cursor-default border-border/50 bg-card/60 shadow-sm backdrop-blur transition-all hover:scale-[1.02]">
			<CardContent className="p-6">
				<div className="flex items-center gap-4">
					<div className={`rounded-2xl bg-muted/50 p-4 ${color}`}>
						<Icon className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<p className="font-black text-[10px] text-muted-foreground/70 uppercase tracking-widest">
							{label}
						</p>
						<h3 className="font-black text-3xl tabular-nums tracking-tighter">
							{value}
						</h3>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function EventItem({ icon: Icon, title, desc, time }: any) {
	return (
		<div className="flex gap-4">
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
				<Icon className="h-4 w-4 text-primary" />
			</div>
			<div className="space-y-0.5">
				<div className="font-bold text-xs">{title}</div>
				<div className="max-w-[150px] truncate text-[10px] text-muted-foreground italic">
					{desc}
				</div>
				<div className="mt-1 font-black text-[9px] text-muted-foreground/30 uppercase tracking-widest">
					{time}
				</div>
			</div>
		</div>
	);
}

// ── Attendance Panel ────────────────────────────────────────────────────────

function AttendancePanel({ activeData, onClose, refreshStats }: any) {
	const [date, setDate] = useState(() => new Date().toISOString().split(" ")[0]);
	const [roster, setRoster] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const fetchRoster = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await client.attendance.getSectionRoster({
				sectionId: activeData.section.id,
				date,
			});
			setRoster(data);
		} catch (err: any) {
			toast.error(err.message || "Failed to load roster");
		} finally {
			setIsLoading(false);
		}
	}, [activeData.section.id, date]);

	useEffect(() => {
		fetchRoster();
	}, [fetchRoster]);

	const handleStatusChange = (studentId: string, status: string) => {
		setRoster((prev) =>
			prev.map((s) => (s.id === studentId ? { ...s, status } : s)),
		);
	};

	const saveAttendance = async () => {
		setIsSaving(true);
		try {
			const formattedRecords = roster
				.filter((s) => s.status !== "not_marked")
				.map((s) => ({ studentId: s.id, status: s.status as any }));

			await client.attendance.submitAttendance({
				sectionId: activeData.section.id,
				date,
				records: formattedRecords,
			});
			toast.success("Attendance saved successfully!");
			refreshStats();
		} catch (err: any) {
			toast.error(err.message || "Failed to save attendance");
		} finally {
			setIsSaving(false);
		}
	};

	const markAll = (status: "present" | "absent") => {
		setRoster((prev) => prev.map((s) => ({ ...s, status })));
	};

	return (
		<Card className="relative overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/5 transition-all bg-card">
			<CardHeader className="bg-primary/5 pb-4">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-xl font-bold">
							<UserCheck className="h-5 w-5 text-primary" />
							Daily Attendance
						</CardTitle>
						<CardDescription className="font-bold text-xs uppercase tracking-tight text-primary/70">
							{activeData.deptName} • Section {activeData.section.name}
						</CardDescription>
					</div>
					<Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
						✕
					</Button>
				</div>
				<div className="pt-2">
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="h-8 rounded-md border border-input bg-background/50 px-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				{isLoading ? (
					<div className="flex h-40 items-center justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : roster.length === 0 ? (
					<div className="p-8 text-center text-sm italic text-muted-foreground">
						No students found in this section.
					</div>
				) : (
					<div className="divide-y divide-border/20 max-h-[400px] overflow-y-auto">
						<div className="flex items-center gap-2 bg-muted/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							<span>Quick Actions:</span>
							<button onClick={() => markAll("present")} className="text-emerald-500 hover:opacity-75">All Present</button>
							<span>•</span>
							<button onClick={() => markAll("late")} className="text-amber-500 hover:opacity-75">All Late</button>
							<span>•</span>
							<button onClick={() => markAll("absent")} className="text-destructive hover:opacity-75">All Absent</button>
						</div>
						{roster.map((student) => (
							<div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-primary/5 transition-colors">
								<div className="min-w-0 flex-1">
									<div className="truncate font-bold text-sm tracking-tight">{student.name}</div>
									<div className="font-mono text-[10px] text-muted-foreground">{student.rollNumber || "No Roll #"}</div>
								</div>
								<div className="flex items-center gap-1 rounded-md border border-border/50 bg-background/50 p-1">
									<button
										onClick={() => handleStatusChange(student.id, "present")}
										className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
											student.status === "present" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
										}`}
									>
										P
									</button>
									<button
										onClick={() => handleStatusChange(student.id, "late")}
										className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
											student.status === "late" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
										}`}
									>
										L
									</button>
									<button
										onClick={() => handleStatusChange(student.id, "absent")}
										className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
											student.status === "absent" ? "bg-destructive text-white shadow-sm" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										}`}
									>
										A
									</button>
									<button
										onClick={() => handleStatusChange(student.id, "excused")}
										className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
											student.status === "excused" ? "bg-indigo-500 text-white shadow-sm" : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-500"
										}`}
									>
										E
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
			<CardFooter className="bg-muted/10 p-4 border-t border-border/10">
				<Button 
					className="w-full font-bold tracking-widest uppercase text-xs h-10 shadow-lg" 
					onClick={saveAttendance}
					disabled={isLoading || isSaving || roster.length === 0}
				>
					{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
					{isSaving ? "Saving Ledger..." : "Save Attendance Ledger"}
				</Button>
			</CardFooter>
		</Card>
	);
}
