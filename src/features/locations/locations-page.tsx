import { useMemo, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
import { api } from "~/utils/api";
import {
	EMPTY_SERVER_ERRORS,
	extractServerFormErrors,
	inputErrorClass,
} from "~/lib/form-errors";

import { ManagerPage } from "../layout/manager-page";

export function LocationsPage() {
	const utils = api.useUtils();
	const locations = api.location.list.useQuery();
	const [selectedScope, setSelectedScope] = useState<
		| { type: "OFFICE"; id: string }
		| { type: "FLOOR"; id: string }
		| { type: "ROOM"; id: string }
	>();
	const scopedAssets = api.location.assetsByScope.useQuery(
		selectedScope
			? { scopeType: selectedScope.type, scopeId: selectedScope.id }
			: skipToken,
	);

	const invalidateLocations = async () => {
		await utils.location.list.invalidate();
	};

	const createOffice = api.location.createOffice.useMutation({
		onSuccess: invalidateLocations,
	});
	const createFloor = api.location.createFloor.useMutation({
		onSuccess: invalidateLocations,
	});
	const createRoom = api.location.createRoom.useMutation({
		onSuccess: invalidateLocations,
	});

	const [officeName, setOfficeName] = useState("HQ");
	const [floorName, setFloorName] = useState("Floor 1");
	const [roomName, setRoomName] = useState("Room A");
	const [officeIdForFloor, setOfficeIdForFloor] = useState<string>();
	const [floorIdForRoom, setFloorIdForRoom] = useState<string>();
	const [officeErrors, setOfficeErrors] = useState(EMPTY_SERVER_ERRORS);
	const [floorErrors, setFloorErrors] = useState(EMPTY_SERVER_ERRORS);
	const [roomErrors, setRoomErrors] = useState(EMPTY_SERVER_ERRORS);

	const floorsForSelectedOffice = useMemo(
		() =>
			(locations.data?.floors ?? []).filter(
				(floor) => floor.officeId === officeIdForFloor,
			),
		[locations.data?.floors, officeIdForFloor],
	);
	const selectedScopeLabel = useMemo(() => {
		if (!selectedScope || !locations.data) return null;
		if (selectedScope.type === "OFFICE") {
			const office = locations.data.offices.find((item) => item.id === selectedScope.id);
			return office ? `Office: ${office.name}` : null;
		}
		if (selectedScope.type === "FLOOR") {
			const floor = locations.data.floors.find((item) => item.id === selectedScope.id);
			return floor ? `Floor: ${floor.name}` : null;
		}
		const room = locations.data.rooms.find((item) => item.id === selectedScope.id);
		return room ? `Room: ${room.name}` : null;
	}, [selectedScope, locations.data]);

	return (
		<ManagerPage
			title="Location Hierarchy"
			description="Manage office, floor, and room structure for asset placement"
		>
			<div className="grid gap-4 xl:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Create office</CardTitle>
						<CardDescription>Top-level location.</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-2"
							onSubmit={async (event) => {
								event.preventDefault();
								setOfficeErrors(EMPTY_SERVER_ERRORS);
								try {
									await createOffice.mutateAsync({ name: officeName });
									toast.success("Office created");
								} catch (error) {
									const parsed = extractServerFormErrors(error);
									setOfficeErrors(parsed);
									toast.error(parsed.formError ?? "Failed to create office");
								}
							}}
						>
							<Input
								value={officeName}
								onChange={(event) => setOfficeName(event.target.value)}
								placeholder="Office name"
								className={inputErrorClass(officeErrors.fieldErrors.name)}
							/>
							{officeErrors.fieldErrors.name ? (
								<p className="text-xs text-destructive">{officeErrors.fieldErrors.name}</p>
							) : null}
							{officeErrors.formError ? (
								<p className="text-sm text-destructive">{officeErrors.formError}</p>
							) : null}
							<Button type="submit" disabled={createOffice.isPending}>
								{createOffice.isPending ? "Saving..." : "Add office"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Create floor</CardTitle>
						<CardDescription>Attach floor to office.</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-2"
							onSubmit={async (event) => {
								event.preventDefault();
								setFloorErrors(EMPTY_SERVER_ERRORS);
								try {
									await createFloor.mutateAsync({
										officeId: officeIdForFloor ?? "",
										name: floorName,
									});
									toast.success("Floor created");
								} catch (error) {
									const parsed = extractServerFormErrors(error);
									setFloorErrors(parsed);
									toast.error(parsed.formError ?? "Failed to create floor");
								}
							}}
						>
							<Select
								value={officeIdForFloor}
								onValueChange={(value) => setOfficeIdForFloor(value ?? undefined)}
							>
								<SelectTrigger className={inputErrorClass(floorErrors.fieldErrors.officeId)}>
									<SelectValue placeholder="Select office" />
								</SelectTrigger>
								<SelectContent>
									{(locations.data?.offices ?? []).map((office) => (
										<SelectItem key={office.id} value={office.id}>
											{office.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								value={floorName}
								onChange={(event) => setFloorName(event.target.value)}
								placeholder="Floor name"
								className={inputErrorClass(floorErrors.fieldErrors.name)}
							/>
							{floorErrors.fieldErrors.officeId ? (
								<p className="text-xs text-destructive">{floorErrors.fieldErrors.officeId}</p>
							) : null}
							{floorErrors.fieldErrors.name ? (
								<p className="text-xs text-destructive">{floorErrors.fieldErrors.name}</p>
							) : null}
							{floorErrors.formError ? (
								<p className="text-sm text-destructive">{floorErrors.formError}</p>
							) : null}
							<Button
								type="submit"
								disabled={createFloor.isPending}
							>
								{createFloor.isPending ? "Saving..." : "Add floor"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Create room</CardTitle>
						<CardDescription>Attach room to floor.</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-2"
							onSubmit={async (event) => {
								event.preventDefault();
								setRoomErrors(EMPTY_SERVER_ERRORS);
								try {
									await createRoom.mutateAsync({
										floorId: floorIdForRoom ?? "",
										name: roomName,
									});
									toast.success("Room created");
								} catch (error) {
									const parsed = extractServerFormErrors(error);
									setRoomErrors(parsed);
									toast.error(parsed.formError ?? "Failed to create room");
								}
							}}
						>
							<Select
								value={officeIdForFloor}
								onValueChange={(value) => {
									setOfficeIdForFloor(value ?? undefined);
									setFloorIdForRoom(undefined);
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select office" />
								</SelectTrigger>
								<SelectContent>
									{(locations.data?.offices ?? []).map((office) => (
										<SelectItem key={office.id} value={office.id}>
											{office.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={floorIdForRoom}
								onValueChange={(value) => setFloorIdForRoom(value ?? undefined)}
							>
								<SelectTrigger className={inputErrorClass(roomErrors.fieldErrors.floorId)}>
									<SelectValue placeholder="Select floor" />
								</SelectTrigger>
								<SelectContent>
									{floorsForSelectedOffice.map((floor) => (
										<SelectItem key={floor.id} value={floor.id}>
											{floor.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								value={roomName}
								onChange={(event) => setRoomName(event.target.value)}
								placeholder="Room name"
								className={inputErrorClass(roomErrors.fieldErrors.name)}
							/>
							{roomErrors.fieldErrors.floorId ? (
								<p className="text-xs text-destructive">{roomErrors.fieldErrors.floorId}</p>
							) : null}
							{roomErrors.fieldErrors.name ? (
								<p className="text-xs text-destructive">{roomErrors.fieldErrors.name}</p>
							) : null}
							{roomErrors.formError ? (
								<p className="text-sm text-destructive">{roomErrors.formError}</p>
							) : null}
							<Button
								type="submit"
								disabled={createRoom.isPending}
							>
								{createRoom.isPending ? "Saving..." : "Add room"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Offices</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(locations.data?.offices ?? []).map((office) => (
									<TableRow
										key={office.id}
										data-state={
											selectedScope?.type === "OFFICE" && selectedScope.id === office.id
												? "selected"
												: undefined
										}
										className="cursor-pointer"
										onClick={() => setSelectedScope({ type: "OFFICE", id: office.id })}
									>
										<TableCell>{office.name}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Floors</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Office ID</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(locations.data?.floors ?? []).map((floor) => (
									<TableRow
										key={floor.id}
										data-state={
											selectedScope?.type === "FLOOR" && selectedScope.id === floor.id
												? "selected"
												: undefined
										}
										className="cursor-pointer"
										onClick={() => setSelectedScope({ type: "FLOOR", id: floor.id })}
									>
										<TableCell>{floor.name}</TableCell>
										<TableCell>{floor.officeId}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Rooms</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Floor ID</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(locations.data?.rooms ?? []).map((room) => (
									<TableRow
										key={room.id}
										data-state={
											selectedScope?.type === "ROOM" && selectedScope.id === room.id
												? "selected"
												: undefined
										}
										className="cursor-pointer"
										onClick={() => setSelectedScope({ type: "ROOM", id: room.id })}
									>
										<TableCell>{room.name}</TableCell>
										<TableCell>{room.floorId}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{selectedScopeLabel ?? "Location assets"}</CardTitle>
					<CardDescription>
						Select an office, floor, or room above to see assigned assets.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!selectedScope ? (
						<p className="text-sm text-muted-foreground">No location selected.</p>
					) : scopedAssets.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading assets...</p>
					) : scopedAssets.isError ? (
						<p className="text-sm text-destructive">
							Failed to load assets for selected location.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Asset</TableHead>
									<TableHead>Barcode</TableHead>
									<TableHead>Category</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(scopedAssets.data ?? []).map((asset) => (
									<TableRow key={asset.id}>
										<TableCell>{asset.name}</TableCell>
										<TableCell>{asset.barcode}</TableCell>
										<TableCell>{asset.category}</TableCell>
										<TableCell>{asset.status}</TableCell>
									</TableRow>
								))}
								{(scopedAssets.data?.length ?? 0) === 0 ? (
									<TableRow>
										<TableCell colSpan={4} className="text-sm text-muted-foreground">
											No assets assigned to this location.
										</TableCell>
									</TableRow>
								) : null}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</ManagerPage>
	);
}
