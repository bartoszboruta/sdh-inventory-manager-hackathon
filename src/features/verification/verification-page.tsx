import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import {
	EMPTY_SERVER_ERRORS,
	extractServerFormErrors,
	inputErrorClass,
} from "~/lib/form-errors";
import { VerificationMethod, VerificationResult } from "~/types/contracts";
import { api } from "~/utils/api";

import { ManagerPage } from "../layout/manager-page";

function statusBadgeVariant(status: "PENDING" | "VERIFIED" | "NOT_VERIFIED") {
	if (status === "VERIFIED") return "default" as const;
	if (status === "NOT_VERIFIED") return "destructive" as const;
	return "secondary" as const;
}

export function VerificationPage() {
	const utils = api.useUtils();
	const cycles = api.verification.listCycles.useQuery();

	const [cycleName, setCycleName] = useState(`Annual ${new Date().getFullYear()}`);
	const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
	const [notesByAsset, setNotesByAsset] = useState<Record<string, string>>({});
	const [cycleErrors, setCycleErrors] = useState(EMPTY_SERVER_ERRORS);
	const [startErrors, setStartErrors] = useState(EMPTY_SERVER_ERRORS);
	const [verifyErrors, setVerifyErrors] = useState(EMPTY_SERVER_ERRORS);
	const [lastSubmittedAssetId, setLastSubmittedAssetId] = useState<string>();
	const [scanDialogOpen, setScanDialogOpen] = useState(false);
	const [manualBarcode, setManualBarcode] = useState("");
	const [scanErrors, setScanErrors] = useState(EMPTY_SERVER_ERRORS);
	const [cameraStatus, setCameraStatus] = useState<
		"idle" | "starting" | "ready" | "error"
	>("idle");
	const [cameraError, setCameraError] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
	const lastScanRef = useRef<{ code: string; at: number } | null>(null);
	const scanInFlightRef = useRef(false);

	const worklist = api.verification.managerWorklist.useQuery({
		employeeId: selectedEmployeeId,
	});

	useEffect(() => {
		const data = worklist.data;
		if (!data) return;
		const validIds = new Set(data.employees.map((employee) => employee.id));
		const nextSelectedEmployeeId =
			selectedEmployeeId && validIds.has(selectedEmployeeId)
				? selectedEmployeeId
				: (data.selectedEmployeeId ?? undefined);
		if (nextSelectedEmployeeId !== selectedEmployeeId) {
			setSelectedEmployeeId(nextSelectedEmployeeId);
		}

		setNotesByAsset((prev) => {
			const next: Record<string, string> = {};
			for (const asset of data.assets) {
				next[asset.id] = prev[asset.id] ?? asset.note ?? "";
			}
			return next;
		});
	}, [selectedEmployeeId, worklist.data]);

	const createCycle = api.verification.createCycle.useMutation({
		onSuccess: async () => {
			await utils.verification.listCycles.invalidate();
			toast.success("Verification cycle created");
		},
		onError: (error) => {
			const parsed = extractServerFormErrors(error);
			setCycleErrors(parsed);
			toast.error(parsed.formError ?? "Failed to create cycle");
		},
	});

	const startCycle = api.verification.startCycle.useMutation({
		onSuccess: async () => {
			setStartErrors(EMPTY_SERVER_ERRORS);
			await Promise.all([
				utils.verification.listCycles.invalidate(),
				utils.verification.managerWorklist.invalidate(),
				utils.dashboard.overview.invalidate(),
			]);
			toast.success("Verification cycle started");
		},
		onError: (error) => {
			const parsed = extractServerFormErrors(error);
			setStartErrors(parsed);
			toast.error(parsed.formError ?? "Failed to start cycle");
		},
	});

	const closeCycle = api.verification.closeCycle.useMutation({
		onSuccess: async () => {
			await Promise.all([
				utils.verification.listCycles.invalidate(),
				utils.verification.managerWorklist.invalidate(),
				utils.dashboard.overview.invalidate(),
			]);
			toast.success("Verification cycle closed");
		},
		onError: (error) => {
			const parsed = extractServerFormErrors(error);
			toast.error(parsed.formError ?? "Failed to close cycle");
		},
	});

	const verifyAsset = api.verification.verifyAsset.useMutation({
		onSuccess: async (_, variables) => {
			setVerifyErrors(EMPTY_SERVER_ERRORS);
			await Promise.all([
				utils.verification.managerWorklist.invalidate(),
				utils.dashboard.overview.invalidate(),
				utils.verification.cycleStats.invalidate({ cycleId: variables.cycleId }),
			]);
			toast.success(
				variables.result === VerificationResult.VERIFIED
					? "Asset marked as verified"
					: "Asset marked as not verified",
			);
		},
		onError: (error) => {
			const parsed = extractServerFormErrors(error);
			setVerifyErrors(parsed);
			toast.error(parsed.formError ?? "Failed to update verification status");
		},
	});
	const verifyAssetByBarcode = api.verification.verifyAssetByBarcode.useMutation({
		onSuccess: async (data) => {
			setScanErrors(EMPTY_SERVER_ERRORS);
			await Promise.all([
				utils.verification.managerWorklist.invalidate(),
				utils.dashboard.overview.invalidate(),
				activeCycle
					? utils.verification.cycleStats.invalidate({ cycleId: activeCycle.id })
					: Promise.resolve(),
			]);
			toast.success(
				data.alreadyVerified
					? `${data.asset.name} (${data.asset.barcode}) is already verified`
					: `${data.asset.name} (${data.asset.barcode}) verified`,
			);
		},
		onError: (error) => {
			const parsed = extractServerFormErrors(error);
			setScanErrors(parsed);
			toast.error(parsed.formError ?? "Failed to verify barcode");
		},
	});

	const activeCycle = useMemo(
		() => worklist.data?.activeCycle ?? null,
		[worklist.data?.activeCycle],
	);

	const selectedEmployeeValue = selectedEmployeeId;
	const canScan = Boolean(activeCycle);

	useEffect(() => {
		if (!scanDialogOpen) {
			scannerControlsRef.current?.stop();
			scannerControlsRef.current = null;
			setCameraStatus("idle");
			setCameraError(null);
			return;
		}

		let cancelled = false;
		setCameraStatus("starting");
		setCameraError(null);

		const startScanner = async () => {
			try {
				if (
					typeof window !== "undefined" &&
					!window.isSecureContext &&
					window.location.hostname !== "localhost" &&
					window.location.hostname !== "127.0.0.1"
				) {
					setCameraStatus("error");
					setCameraError(
						"Camera requires HTTPS on mobile browsers. Open this app over https:// to use scanning.",
					);
					return;
				}

				const { BrowserMultiFormatReader } = await import("@zxing/browser");
				if (cancelled || !videoRef.current) return;

				const codeReader = new BrowserMultiFormatReader();

				const onDecode = async (result: unknown, error: unknown) => {
					if (cancelled || scanInFlightRef.current || !activeCycle) return;
					if (
						result &&
						typeof result === "object" &&
						"getText" in result &&
						typeof (result as { getText: () => string }).getText === "function"
					) {
						const code = (result as { getText: () => string }).getText().trim();
						if (!code) return;
						const now = Date.now();
						const last = lastScanRef.current;
						if (last && last.code === code && now - last.at < 1500) return;
						lastScanRef.current = { code, at: now };
						setManualBarcode(code);
						setScanErrors(EMPTY_SERVER_ERRORS);
						scanInFlightRef.current = true;
						try {
							await verifyAssetByBarcode.mutateAsync({
								cycleId: activeCycle.id,
								barcode: code,
							});
						} finally {
							scanInFlightRef.current = false;
						}
						return;
					}

					if (
						error &&
						!(error instanceof Error && error.name === "NotFoundException")
					) {
						setCameraStatus("error");
						setCameraError("Camera scanning is unavailable. Use manual barcode input.");
					}
				};

				let controls: { stop: () => void } | null = null;
				try {
					controls = await codeReader.decodeFromConstraints(
						{
							audio: false,
							video: {
								facingMode: { ideal: "environment" },
							},
						},
						videoRef.current,
						onDecode,
					);
				} catch {
					controls = await codeReader.decodeFromVideoDevice(
						undefined,
						videoRef.current,
						onDecode,
					);
				}

				if (cancelled) {
					controls?.stop();
					return;
				}

				scannerControlsRef.current = controls;
				setCameraStatus("ready");
			} catch {
				if (cancelled) return;
				setCameraStatus("error");
				setCameraError("Camera access blocked or unavailable. Use manual barcode input.");
			}
		};

		void startScanner();

		return () => {
			cancelled = true;
			scannerControlsRef.current?.stop();
			scannerControlsRef.current = null;
		};
	}, [scanDialogOpen, activeCycle?.id]);

	return (
		<ManagerPage
			title="Verification Cycles"
			description="Run active-cycle checks by employee and explicitly capture missing assets"
		>
			<div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
				<Card>
					<CardHeader>
						<CardTitle>Create cycle</CardTitle>
						<CardDescription>
							Plan cycle dates first, then activate when field operations are ready.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-2"
							onSubmit={async (event) => {
								event.preventDefault();
								const now = new Date();
								const end = new Date(now);
								end.setDate(now.getDate() + 7);
								setCycleErrors(EMPTY_SERVER_ERRORS);
								await createCycle.mutateAsync({
									name: cycleName,
									startsAt: now,
									endsAt: end,
								});
							}}
						>
							<Input
								value={cycleName}
								onChange={(event) => setCycleName(event.target.value)}
								placeholder="Cycle name"
								className={inputErrorClass(cycleErrors.fieldErrors.name)}
							/>
							{cycleErrors.fieldErrors.name ? (
								<p className="text-xs text-destructive">{cycleErrors.fieldErrors.name}</p>
							) : null}
							{cycleErrors.formError ? (
								<p className="text-sm text-destructive">{cycleErrors.formError}</p>
							) : null}
							<Button disabled={createCycle.isPending} type="submit">
								{createCycle.isPending ? "Creating..." : "Create cycle"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Cycle list</CardTitle>
						<CardDescription>
							Only one cycle can be active at a time. Start and close from here.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{(cycles.data ?? []).map((cycle) => (
							<div
								key={cycle.id}
								className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="space-y-1">
									<p className="font-medium">{cycle.name}</p>
									<p className="text-sm text-muted-foreground">
										Status: <span className="font-medium">{cycle.status}</span>
									</p>
								</div>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											setStartErrors(EMPTY_SERVER_ERRORS);
											startCycle.mutate({ cycleId: cycle.id });
										}}
										disabled={startCycle.isPending || cycle.status === "ACTIVE"}
									>
										Start
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => closeCycle.mutate({ cycleId: cycle.id })}
										disabled={closeCycle.isPending || cycle.status !== "ACTIVE"}
									>
										Close
									</Button>
								</div>
							</div>
						))}
						{startErrors.formError ? (
							<p className="text-sm text-destructive">{startErrors.formError}</p>
						) : null}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Employee verification worklist</CardTitle>
					<CardDescription>
						{activeCycle
							? `Active cycle: ${activeCycle.name}`
							: "Start a cycle to review assigned assets by employee."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{worklist.isLoading ? (
						<p className="text-sm text-muted-foreground">
							Loading verification worklist...
						</p>
					) : worklist.isError ? (
						<p className="text-sm text-destructive">
							Failed to load verification worklist. Refresh the page and try again.
						</p>
					) : !activeCycle ? (
						<p className="text-sm text-muted-foreground">
							No active cycle is running.
						</p>
					) : worklist.data?.eligibleEmployeeCount === 0 ? (
						<div className="space-y-3 rounded-lg border border-border/70 p-4">
							<p className="text-sm font-medium">
								Cycle started, but no employees have active assigned assets.
							</p>
							<p className="text-sm text-muted-foreground">
								Assign assets to employees or create employees before running verification.
							</p>
							<div className="flex flex-wrap gap-2">
								<Link href="/assets" className={buttonVariants({ variant: "outline", size: "sm" })}>
									Assign assets
								</Link>
								<Link href="/employees" className={buttonVariants({ variant: "outline", size: "sm" })}>
									Create employee
								</Link>
							</div>
						</div>
					) : (
						<>
							<div className="flex flex-wrap items-end gap-2">
								<div className="grid gap-1.5 sm:max-w-sm">
									<p className="text-sm text-muted-foreground">Employee</p>
									<Select
										value={selectedEmployeeValue}
										onValueChange={(value) => {
											setSelectedEmployeeId(value ?? undefined);
											setVerifyErrors(EMPTY_SERVER_ERRORS);
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select employee" />
										</SelectTrigger>
										<SelectContent>
											{(worklist.data?.employees ?? []).map((employee) => (
												<SelectItem key={employee.id} value={employee.id}>
													{employee.firstName} {employee.lastName} ({employee.email})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<Button
									variant="outline"
									onClick={() => {
										setScanErrors(EMPTY_SERVER_ERRORS);
										setScanDialogOpen(true);
									}}
									disabled={!canScan}
								>
									Scan barcode
								</Button>
							</div>

							<div className="rounded-md border border-border/70">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Asset</TableHead>
											<TableHead>Location</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Note</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(worklist.data?.assets ?? []).map((asset) => (
											<TableRow
												key={asset.id}
												className={
													verifyErrors.fieldErrors.assetId && lastSubmittedAssetId === asset.id
														? "bg-destructive/5"
														: undefined
												}
											>
												<TableCell>
													<p className="font-medium">{asset.name}</p>
													<p className="text-xs text-muted-foreground">{asset.barcode}</p>
												</TableCell>
												<TableCell className="text-sm text-muted-foreground">
													{[asset.officeName, asset.floorName, asset.roomName]
														.filter(Boolean)
														.join(" / ") || "Unassigned location"}
												</TableCell>
												<TableCell>
													<Badge variant={statusBadgeVariant(asset.status)}>{asset.status}</Badge>
												</TableCell>
												<TableCell>
													<Textarea
														value={notesByAsset[asset.id] ?? ""}
														onChange={(event) =>
															setNotesByAsset((prev) => ({
																...prev,
																[asset.id]: event.target.value,
															}))
														}
														placeholder="Optional note"
														rows={2}
														className={
															verifyErrors.fieldErrors.note && lastSubmittedAssetId === asset.id
																? inputErrorClass(verifyErrors.fieldErrors.note)
																: undefined
														}
													/>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															variant="outline"
															className="h-8 min-w-32 px-3 text-xs"
															disabled={verifyAsset.isPending}
															onClick={async () => {
																if (!activeCycle) return;
																setLastSubmittedAssetId(asset.id);
																setVerifyErrors(EMPTY_SERVER_ERRORS);
																await verifyAsset.mutateAsync({
																	cycleId: activeCycle.id,
																	assetId: asset.id,
																	result: VerificationResult.VERIFIED,
																	method: VerificationMethod.MANUAL,
																	note: notesByAsset[asset.id]?.trim() || undefined,
																});
															}}
														>
															Mark verified
														</Button>
														<Button
															variant="destructive"
															className="h-8 min-w-32 px-3 text-xs"
															disabled={verifyAsset.isPending}
															onClick={async () => {
																if (!activeCycle) return;
																setLastSubmittedAssetId(asset.id);
																setVerifyErrors(EMPTY_SERVER_ERRORS);
																await verifyAsset.mutateAsync({
																	cycleId: activeCycle.id,
																	assetId: asset.id,
																	result: VerificationResult.NOT_VERIFIED,
																	method: VerificationMethod.MANUAL,
																	note: notesByAsset[asset.id]?.trim() || undefined,
																});
															}}
														>
															Mark not verified
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
										{(worklist.data?.assets.length ?? 0) === 0 ? (
											<TableRow>
												<TableCell colSpan={5} className="text-sm text-muted-foreground">
													No active assigned assets for this employee.
												</TableCell>
											</TableRow>
										) : null}
									</TableBody>
								</Table>
							</div>
							{verifyErrors.fieldErrors.assetId && lastSubmittedAssetId ? (
								<p className="text-xs text-destructive">{verifyErrors.fieldErrors.assetId}</p>
							) : null}
							{verifyErrors.formError ? (
								<p className="text-sm text-destructive">{verifyErrors.formError}</p>
							) : null}
						</>
					)}
				</CardContent>
			</Card>

			<Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Scan asset barcode</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<div className="overflow-hidden rounded-md border border-border/70 bg-black">
							<video
								ref={videoRef}
								muted
								autoPlay
								playsInline
								className="aspect-video w-full object-cover"
							/>
						</div>
						<p className="text-xs text-muted-foreground">
							{cameraStatus === "starting"
								? "Starting camera..."
								: cameraStatus === "ready"
									? "Point camera at barcode to auto-verify."
									: cameraError ?? "Use manual barcode input if camera is unavailable."}
						</p>
						<div className="grid gap-2">
							<p className="text-sm text-muted-foreground">Manual barcode fallback</p>
							<div className="flex gap-2">
								<Input
									value={manualBarcode}
									onChange={(event) => setManualBarcode(event.target.value)}
									placeholder="Enter barcode"
									className={inputErrorClass(scanErrors.fieldErrors.barcode)}
								/>
								<Button
									disabled={verifyAssetByBarcode.isPending || !activeCycle}
									onClick={async () => {
										if (!activeCycle) return;
										setScanErrors(EMPTY_SERVER_ERRORS);
										await verifyAssetByBarcode.mutateAsync({
											cycleId: activeCycle.id,
											barcode: manualBarcode,
										});
									}}
								>
									{verifyAssetByBarcode.isPending ? "Checking..." : "Verify"}
								</Button>
							</div>
							{scanErrors.fieldErrors.barcode ? (
								<p className="text-xs text-destructive">{scanErrors.fieldErrors.barcode}</p>
							) : null}
							{scanErrors.formError ? (
								<p className="text-sm text-destructive">{scanErrors.formError}</p>
							) : null}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</ManagerPage>
	);
}
