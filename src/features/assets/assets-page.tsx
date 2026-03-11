import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
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
import { AssetStatus } from "~/types/contracts";
import { api } from "~/utils/api";

import { ManagerPage } from "../layout/manager-page";

type ReassignDialogAsset = {
	id: string;
	name: string;
	currentEmployeeId: string | null;
	currentRoomId: string | null;
};

type ReassignDialogEmployee = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
};

type ReassignDialogLocations = {
	offices: Array<{ id: string; name: string }>;
	floors: Array<{ id: string; officeId: string; name: string }>;
	rooms: Array<{ id: string; floorId: string; name: string }>;
} | null;

function ReassignAssetDialog({
	asset,
	employees,
	locations,
	isPending,
	onSubmit,
}: {
	asset: ReassignDialogAsset;
	employees: ReassignDialogEmployee[];
	locations: ReassignDialogLocations | undefined;
	isPending: boolean;
	onSubmit: (payload: {
		toEmployeeId: string;
		toRoomId: string;
		note?: string;
	}) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [toEmployeeId, setToEmployeeId] = useState<string>();
	const [officeId, setOfficeId] = useState<string>();
	const [floorId, setFloorId] = useState<string>();
	const [toRoomId, setToRoomId] = useState<string>();
	const [note, setNote] = useState("");
	const [errors, setErrors] = useState(EMPTY_SERVER_ERRORS);

	const offices = locations?.offices ?? [];
	const floors = locations?.floors ?? [];
	const rooms = locations?.rooms ?? [];

	const floorsForOffice = useMemo(
		() => floors.filter((floor) => floor.officeId === officeId),
		[floors, officeId],
	);
	const roomsForFloor = useMemo(
		() => rooms.filter((room) => room.floorId === floorId),
		[rooms, floorId],
	);
	const selectedRoom = useMemo(
		() => rooms.find((room) => room.id === toRoomId) ?? null,
		[rooms, toRoomId],
	);

	const canSubmit = !isPending;

	const resetState = () => {
		setToEmployeeId(undefined);
		setOfficeId(undefined);
		setFloorId(undefined);
		setToRoomId(undefined);
		setNote("");
		setErrors(EMPTY_SERVER_ERRORS);
	};

	return (
		<>
			<Button
				size="sm"
				variant="outline"
				onClick={() => {
					resetState();
					setOpen(true);
				}}
			>
				Reassign
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reassign asset</DialogTitle>
						<DialogDescription>{asset.name}</DialogDescription>
					</DialogHeader>

					<div className="grid gap-3">
						<div className="grid gap-1.5">
							<p className="text-sm text-muted-foreground">Employee</p>
							<Select
								value={toEmployeeId}
								onValueChange={(value) => setToEmployeeId(value ?? undefined)}
							>
								<SelectTrigger className={inputErrorClass(errors.fieldErrors.toEmployeeId)}>
									<SelectValue placeholder="Select employee" />
								</SelectTrigger>
								<SelectContent>
									{employees.map((employee) => (
										<SelectItem key={employee.id} value={employee.id}>
											{employee.firstName} {employee.lastName} ({employee.email})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<p className="text-sm text-muted-foreground">Office</p>
							<Select
								value={officeId}
								onValueChange={(value) => {
									setOfficeId(value ?? undefined);
									setFloorId(undefined);
									setToRoomId(undefined);
									setErrors(EMPTY_SERVER_ERRORS);
								}}
							>
								<SelectTrigger className={inputErrorClass(errors.fieldErrors.officeId)}>
									<SelectValue placeholder="Select office" />
								</SelectTrigger>
								<SelectContent>
									{offices.map((office) => (
										<SelectItem key={office.id} value={office.id}>
											{office.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<p className="text-sm text-muted-foreground">Floor</p>
							<Select
								value={floorId}
								onValueChange={(value) => {
									setFloorId(value ?? undefined);
									setToRoomId(undefined);
									setErrors(EMPTY_SERVER_ERRORS);
								}}
								disabled={!officeId}
							>
								<SelectTrigger className={inputErrorClass(errors.fieldErrors.floorId)}>
									<SelectValue placeholder="Select floor" />
								</SelectTrigger>
								<SelectContent>
									{floorsForOffice.map((floor) => (
										<SelectItem key={floor.id} value={floor.id}>
											{floor.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<p className="text-sm text-muted-foreground">Room</p>
							<Select
								value={toRoomId}
								onValueChange={(value) => {
									setToRoomId(value ?? undefined);
									setErrors(EMPTY_SERVER_ERRORS);
								}}
								disabled={!floorId}
							>
								<SelectTrigger className={inputErrorClass(errors.fieldErrors.toRoomId)}>
									<SelectValue placeholder="Select room" />
								</SelectTrigger>
								<SelectContent>
									{roomsForFloor.map((room) => (
										<SelectItem key={room.id} value={room.id}>
											{room.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<p className="text-sm text-muted-foreground">Note (optional)</p>
							<Textarea
								value={note}
								maxLength={500}
								onChange={(event) => setNote(event.target.value)}
								placeholder="Reason for reassignment"
								className={inputErrorClass(errors.fieldErrors.note)}
							/>
						</div>

						{errors.fieldErrors.toEmployeeId ? (
							<p className="text-xs text-destructive">{errors.fieldErrors.toEmployeeId}</p>
						) : null}
						{errors.fieldErrors.toRoomId ? (
							<p className="text-xs text-destructive">{errors.fieldErrors.toRoomId}</p>
						) : null}
						{errors.formError ? <p className="text-sm text-destructive">{errors.formError}</p> : null}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
							Cancel
						</Button>
						<Button
							disabled={!canSubmit}
							onClick={async () => {
								try {
									setErrors(EMPTY_SERVER_ERRORS);
									if (!toEmployeeId || !toRoomId) {
										await onSubmit({
											toEmployeeId: "",
											toRoomId: "",
											note: note.trim() || undefined,
										});
										return;
									}

									await onSubmit({
										toEmployeeId,
										toRoomId,
										note: note.trim() || undefined,
									});
									setOpen(false);
									resetState();
									toast.success("Asset reassigned");
								} catch (error) {
									const parsed = extractServerFormErrors(error);
									setErrors(parsed);
									toast.error(parsed.formError ?? "Failed to reassign asset");
								}
							}}
						>
							{isPending ? "Saving..." : "Save reassignment"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

export function AssetsPage() {
	const utils = api.useUtils();
	const locations = api.location.list.useQuery();
	const employees = api.employee.list.useQuery({ page: 1, pageSize: 100 });
	const assignableEmployees = api.employee.listAssignable.useQuery();
	const [showRemoved, setShowRemoved] = useState(false);
	const [selectedAssetId, setSelectedAssetId] = useState<string>();
	const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
	const categoryOptions = api.asset.categoryOptions.useQuery();
	const assets = api.asset.list.useQuery({
		page: 1,
		pageSize: 100,
		includeRetired: showRemoved,
	});

	const invalidateAssets = async () => {
		await utils.asset.list.invalidate();
		await utils.dashboard.overview.invalidate();
	};

	const createAsset = api.asset.create.useMutation({
		onSuccess: invalidateAssets,
	});
	const updateStatus = api.asset.updateStatus.useMutation({
		onSuccess: invalidateAssets,
	});
	const reassign = api.asset.reassign.useMutation({
		onSuccess: invalidateAssets,
	});
	const removeAsset = api.asset.remove.useMutation({
		onSuccess: invalidateAssets,
	});
	const restoreAsset = api.asset.restore.useMutation({
		onSuccess: invalidateAssets,
	});

	const [barcode, setBarcode] = useState("ASSET-001");
	const [assetName, setAssetName] = useState("Desk");
	const [selectedCategory, setSelectedCategory] = useState<string>();
	const [customCategory, setCustomCategory] = useState("");
	const [currentEmployeeId, setCurrentEmployeeId] = useState<string>();
	const [currentRoomId, setCurrentRoomId] = useState<string>();
	const [createErrors, setCreateErrors] = useState(EMPTY_SERVER_ERRORS);

	const employeeOptions = employees.data?.items ?? [];
	const roomOptions = locations.data?.rooms ?? [];
	const selectedAsset = useMemo(
		() => (assets.data?.items ?? []).find((asset) => asset.id === selectedAssetId) ?? null,
		[assets.data?.items, selectedAssetId],
	);
	const categoryList = categoryOptions.data?.merged ?? [];

	useEffect(() => {
		if (selectedCategory || categoryList.length === 0) return;
		setSelectedCategory(categoryList[0]);
	}, [selectedCategory, categoryList]);

	return (
		<ManagerPage
			title="Asset Operations"
			description="Lifecycle management, ownership changes, and status controls"
		>
			<div className="grid gap-4 xl:grid-cols-[420px_1fr]">
				<Card className="h-fit">
					<CardHeader>
						<CardTitle>Create asset</CardTitle>
						<CardDescription>Add new equipment to inventory.</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-2"
							onSubmit={async (event) => {
								event.preventDefault();
								setCreateErrors(EMPTY_SERVER_ERRORS);
								const finalCategory = customCategory.trim() || selectedCategory || "";
								try {
									await createAsset.mutateAsync({
										barcode,
										name: assetName,
										category: finalCategory,
										currentEmployeeId,
										currentRoomId,
										tags: finalCategory ? [finalCategory.toLowerCase()] : [],
									});
									await utils.asset.categoryOptions.invalidate();
									toast.success("Asset created");
								} catch (error) {
									const parsed = extractServerFormErrors(error);
									setCreateErrors(parsed);
									toast.error(parsed.formError ?? "Failed to create asset");
								}
							}}
						>
							<Input
								value={barcode}
								onChange={(event) => setBarcode(event.target.value)}
								placeholder="Barcode"
								className={inputErrorClass(createErrors.fieldErrors.barcode)}
							/>
							{createErrors.fieldErrors.barcode ? (
								<p className="text-xs text-destructive">{createErrors.fieldErrors.barcode}</p>
							) : null}
							<Input
								value={assetName}
								onChange={(event) => setAssetName(event.target.value)}
								placeholder="Name"
								className={inputErrorClass(createErrors.fieldErrors.name)}
							/>
							{createErrors.fieldErrors.name ? (
								<p className="text-xs text-destructive">{createErrors.fieldErrors.name}</p>
							) : null}
							<Select
								value={selectedCategory}
								onValueChange={(value) => setSelectedCategory(value ?? undefined)}
							>
								<SelectTrigger className={inputErrorClass(createErrors.fieldErrors.category)}>
									<SelectValue placeholder="Select category" />
								</SelectTrigger>
								<SelectContent>
									{categoryList.map((categoryOption) => (
										<SelectItem key={categoryOption} value={categoryOption}>
											{categoryOption}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								value={customCategory}
								onChange={(event) => setCustomCategory(event.target.value)}
								placeholder="Custom category (optional)"
								className={inputErrorClass(createErrors.fieldErrors.category)}
							/>
							{createErrors.fieldErrors.category ? (
								<p className="text-xs text-destructive">{createErrors.fieldErrors.category}</p>
							) : null}
							<Select
								value={currentEmployeeId}
								onValueChange={(value) => setCurrentEmployeeId(value ?? undefined)}
							>
								<SelectTrigger className={inputErrorClass(createErrors.fieldErrors.currentEmployeeId)}>
									<SelectValue placeholder="Assign employee (optional)" />
								</SelectTrigger>
								<SelectContent>
									{employeeOptions.map((employee) => (
										<SelectItem key={employee.id} value={employee.id}>
											{employee.firstName} {employee.lastName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={currentRoomId}
								onValueChange={(value) => setCurrentRoomId(value ?? undefined)}
							>
								<SelectTrigger className={inputErrorClass(createErrors.fieldErrors.currentRoomId)}>
									<SelectValue placeholder="Assign room (optional)" />
								</SelectTrigger>
								<SelectContent>
									{roomOptions.map((room) => (
										<SelectItem key={room.id} value={room.id}>
											{room.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{createErrors.formError ? (
								<p className="text-sm text-destructive">{createErrors.formError}</p>
							) : null}
							<Button disabled={createAsset.isPending} type="submit">
								{createAsset.isPending ? "Creating..." : "Add asset"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Assets</CardTitle>
							<CardDescription>
								Status controls, reassignment, and retirement management.
							</CardDescription>
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setShowRemoved((current) => !current)}
						>
							{showRemoved ? "Hide removed" : "Show removed"}
						</Button>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Barcode</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(assets.data?.items ?? []).map((asset) => (
									<TableRow
										key={asset.id}
										className="cursor-pointer"
										onClick={() => {
											setSelectedAssetId(asset.id);
											setAssetDetailsOpen(true);
										}}
									>
										<TableCell>{asset.name}</TableCell>
										<TableCell>{asset.barcode}</TableCell>
										<TableCell>
											<Badge>{asset.status}</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<Dialog open={assetDetailsOpen} onOpenChange={setAssetDetailsOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>{selectedAsset?.name ?? "Asset details"}</DialogTitle>
						<DialogDescription>
							Complete asset info and lifecycle actions.
						</DialogDescription>
					</DialogHeader>
					{selectedAsset ? (
						<div className="grid gap-4">
							<div className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-2">
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">Barcode</p>
									<p className="text-sm">{selectedAsset.barcode}</p>
								</div>
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
									<p className="text-sm">{selectedAsset.status}</p>
								</div>
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
									<p className="text-sm">{selectedAsset.category}</p>
								</div>
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">Employee ID</p>
									<p className="text-sm">{selectedAsset.currentEmployeeId ?? "Unassigned"}</p>
								</div>
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">Room ID</p>
									<p className="text-sm">{selectedAsset.currentRoomId ?? "Unassigned"}</p>
								</div>
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
									<p className="text-sm">{new Date(selectedAsset.createdAt).toLocaleString()}</p>
								</div>
							</div>

							<div className="flex flex-wrap gap-2">
								{selectedAsset.status === AssetStatus.RETIRED ? (
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											restoreAsset.mutate({ assetId: selectedAsset.id });
											toast.success("Asset restored");
										}}
									>
										Restore
									</Button>
								) : (
									<>
										<Button
											size="sm"
											variant="outline"
											onClick={() => {
												updateStatus.mutate({
													assetId: selectedAsset.id,
													status:
														selectedAsset.status === AssetStatus.BROKEN
															? AssetStatus.ACTIVE
															: AssetStatus.BROKEN,
												});
												toast.success(
													selectedAsset.status === AssetStatus.BROKEN
														? "Asset marked active"
														: "Asset marked broken",
												);
											}}
										>
											{selectedAsset.status === AssetStatus.BROKEN
												? "Mark active"
												: "Mark broken"}
										</Button>
										<ReassignAssetDialog
											asset={{
												id: selectedAsset.id,
												name: selectedAsset.name,
												currentEmployeeId: selectedAsset.currentEmployeeId,
												currentRoomId: selectedAsset.currentRoomId,
											}}
											employees={assignableEmployees.data ?? []}
											locations={locations.data}
											isPending={reassign.isPending}
											onSubmit={async (payload) => {
												await reassign.mutateAsync({
													assetId: selectedAsset.id,
													...payload,
												});
											}}
										/>
										<Button
											size="sm"
											variant="outline"
											onClick={() => {
												removeAsset.mutate({
													assetId: selectedAsset.id,
													note: "Removed from manager assets page",
												});
												toast.success("Asset removed");
												setAssetDetailsOpen(false);
											}}
										>
											Remove
										</Button>
									</>
								)}
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">Asset not found.</p>
					)}
				</DialogContent>
			</Dialog>
		</ManagerPage>
	);
}
