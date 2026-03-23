import { env } from "@sms/env/web";
import { Alert, AlertDescription, AlertTitle } from "@sms/ui/components/alert";
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
import {
	AlertCircle,
	ArrowLeft,
	Download,
	FileText,
	Loader2,
	ShieldCheck,
	Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/onboarding/upload")({
	component: OnboardingUpload,
});

function OnboardingUpload() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const [institutionId, setInstitutionId] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [file, setFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const loadOrg = async () => {
			const { data: orgs } = await authClient.organization.list();
			if (orgs && orgs.length > 0) {
				setInstitutionId(orgs[0].id);
			}
		};
		if (session?.user) loadOrg();
	}, [session]);

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
			toast.success("Template downloaded! Fill it and upload here.");
		} catch (_err) {
			toast.error("Failed to download template.");
		} finally {
			setIsDownloading(false);
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			if (!selectedFile.name.endsWith(".xlsx")) {
				toast.error("Please upload a valid .xlsx Excel file.");
				return;
			}
			setFile(selectedFile);
		}
	};

	const handleUpload = async () => {
		if (!file || !institutionId) return;

		setIsUploading(true);
		setUploadProgress(10);

		const formData = new FormData();
		formData.append("file", file);
		formData.append("institutionId", institutionId);

		try {
			setUploadProgress(30);
			const data = await client.onboarding.uploadTemplate({
				file,
				institutionId,
			});

			setUploadProgress(100);
			toast.success(data.message || "Upload successful!");
			setTimeout(() => navigate({ to: "/dashboard" }), 1500);
		} catch (_err) {
			toast.error("Network error during upload.");
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 pt-10 pb-20">
			<div className="w-full max-w-2xl space-y-8">
				<div className="space-y-2">
					<button
						onClick={() => navigate({ to: "/onboarding/setup" })}
						className="mb-4 flex items-center font-medium text-muted-foreground text-sm transition-colors hover:text-primary"
					>
						<ArrowLeft className="mr-1 h-4 w-4" /> Back to Branch Setup
					</button>
					<h1 className="font-black text-4xl tracking-tight">
						Bulk Import <span className="text-primary italic">Structure</span>
					</h1>
					<p className="text-muted-foreground">
						The fastest way to set up your entire institution at once.
					</p>
				</div>

				{/* Step 1: Download */}
				<Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur">
					<CardHeader className="pb-3">
						<div className="mb-1 flex items-center gap-2 font-bold text-primary text-xs uppercase tracking-widest">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
								1
							</span>
							Get the template
						</div>
						<CardTitle className="text-xl">Download Setup Sheet</CardTitle>
						<CardDescription>
							We've pre-filled the template with your branch names for
							convenience.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="h-12 w-full border-primary/20 font-bold hover:bg-primary/5"
							onClick={handleDownloadTemplate}
							disabled={isDownloading}
						>
							{isDownloading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Download className="mr-2 h-4 w-4 text-primary" />
							)}
							Download .XLSX Template
						</Button>
					</CardContent>
				</Card>

				{/* Step 2: Upload */}
				<Card className="relative overflow-hidden border-primary/20 bg-primary/5 shadow-primary/5 shadow-xl">
					{isUploading && (
						<div
							className="absolute top-0 left-0 h-1 bg-primary transition-all duration-500"
							style={{ width: `${uploadProgress}%` }}
						/>
					)}
					<CardHeader className="pb-3">
						<div className="mb-1 flex items-center gap-2 font-bold text-primary text-xs uppercase tracking-widest">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
								2
							</span>
							Upload Filled Sheet
						</div>
						<CardTitle className="text-xl">Submit for Processing</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							onClick={() => fileInputRef.current?.click()}
							className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 transition-all ${file ? "border-primary/40 bg-primary/10" : "border-border hover:border-primary/30 hover:bg-white/5"}`}
						>
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileSelect}
								className="hidden"
								accept=".xlsx"
							/>

							{file ? (
								<>
									<div className="rounded-full bg-primary/20 p-4">
										<FileText className="h-10 w-10 text-primary" />
									</div>
									<div className="text-center">
										<p className="font-bold text-lg">{file.name}</p>
										<p className="text-muted-foreground text-xs">
											{(file.size / 1024).toFixed(1)} KB &bull; Ready to upload
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="text-muted-foreground text-xs hover:text-destructive"
										onClick={(e) => {
											e.stopPropagation();
											setFile(null);
										}}
									>
										Remove file
									</Button>
								</>
							) : (
								<>
									<div className="rounded-full bg-muted/50 p-4">
										<Upload className="h-10 w-10 text-muted-foreground" />
									</div>
									<div className="text-center">
										<p className="font-bold">
											Drag and drop or click to browse
										</p>
										<p className="text-muted-foreground text-xs">
											Standard .xlsx spreadsheets only
										</p>
									</div>
								</>
							)}
						</div>

						{file && (
							<Alert className="mt-6 border-emerald-500/20 bg-emerald-500/5">
								<ShieldCheck className="h-4 w-4 text-emerald-500" />
								<AlertTitle className="font-bold text-emerald-500">
									Safe for Processing
								</AlertTitle>
								<AlertDescription className="text-xs">
									Our system will automatically create departments, sections,
									and users based on your file.
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
					<CardFooter className="bg-muted/30 pt-6">
						<Button
							className="h-14 w-full font-black text-lg tracking-tight shadow-lg shadow-primary/20"
							disabled={!file || isUploading}
							onClick={handleUpload}
						>
							{isUploading ? (
								<>
									<Loader2 className="mr-3 h-5 w-5 animate-spin" />
									Processing Institution... {uploadProgress}%
								</>
							) : (
								"Complete Onboarding"
							)}
						</Button>
					</CardFooter>
				</Card>

				{/* Help Tip */}
				<div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4">
					<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
					<div className="space-y-1">
						<p className="font-bold text-muted-foreground text-xs uppercase tracking-widest">
							Quick Tip
						</p>
						<p className="text-muted-foreground text-xs leading-relaxed">
							Make sure the <strong>Branch Names</strong> in your Excel exactly
							match the ones you defined in the previous step. You can always go
							back and change them.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
