import { useEffect, useMemo, useState } from "react";
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
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import type { OfficeLayout, TilesetId } from "~/types/contracts";

import { OfficeLayoutGrid } from "./components/office-layout-grid";
import { TileSprite } from "./components/tile-sprite";
import { getCellKey, TILESET_BY_ID, TILESET_CONFIGS } from "./game-tiles";
import { ManagerPage } from "../layout/manager-page";

type AtlasSize = {
	columns: number;
	rows: number;
};

type TilesetLoadInfo = {
	width: number;
	height: number;
	valid: boolean;
	error?: string;
};

type DragPoint = {
	x: number;
	y: number;
};

const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 16;
const TILE_PREVIEW_SIZE = 24;
const TILE_PREVIEW_GAP = 4;

function isMissingGameMigrationError(message?: string): boolean {
	if (!message) return false;
	const normalized = message.toLowerCase();
	return (
		normalized.includes("office_layout") &&
		(normalized.includes("no such table") ||
			normalized.includes("does not exist") ||
			normalized.includes("sqlite"))
	);
}

function getRectangleCells(start: DragPoint, end: DragPoint): DragPoint[] {
	const minX = Math.min(start.x, end.x);
	const maxX = Math.max(start.x, end.x);
	const minY = Math.min(start.y, end.y);
	const maxY = Math.max(start.y, end.y);
	const cells: DragPoint[] = [];
	for (let y = minY; y <= maxY; y += 1) {
		for (let x = minX; x <= maxX; x += 1) {
			cells.push({ x, y });
		}
	}
	return cells;
}

export function ManagerGameBuilderPage() {
	const utils = api.useUtils();
	const [selectedOfficeId, setSelectedOfficeId] = useState<string>();
	const [newOfficeName, setNewOfficeName] = useState("HQ");
	const [widthInput, setWidthInput] = useState<number>(DEFAULT_WIDTH);
	const [heightInput, setHeightInput] = useState<number>(DEFAULT_HEIGHT);
	const [selectedTilesetId, setSelectedTilesetId] = useState<TilesetId>(
		"Room_Builder_Office_16x16",
	);
	const [selectedTile, setSelectedTile] = useState({ tileX: 0, tileY: 0 });
	const [isAreaPainting, setIsAreaPainting] = useState(false);
	const [dragStart, setDragStart] = useState<DragPoint | null>(null);
	const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);
	const [suppressNextClick, setSuppressNextClick] = useState(false);
	const [atlasSizeByTileset, setAtlasSizeByTileset] = useState<
		Partial<Record<TilesetId, AtlasSize>>
	>({});
	const [tilesetInfoById, setTilesetInfoById] = useState<
		Partial<Record<TilesetId, TilesetLoadInfo>>
	>({});

	const officeOptions = api.game.managerListOfficesWithLayoutStatus.useQuery();
	const layoutQuery = api.game.managerGetOfficeLayout.useQuery(
		selectedOfficeId ? { officeId: selectedOfficeId } : skipToken,
	);
	const createOffice = api.location.createOffice.useMutation({
		onSuccess: async (office) => {
			if (!office) {
				toast.error("Office was not created");
				return;
			}
			await utils.game.managerListOfficesWithLayoutStatus.invalidate();
			setSelectedOfficeId(office.id);
			toast.success("Office created");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	useEffect(() => {
		const firstOfficeId = officeOptions.data?.[0]?.id;
		if (firstOfficeId && !selectedOfficeId) {
			setSelectedOfficeId(firstOfficeId);
		}
	}, [officeOptions.data, selectedOfficeId]);

	useEffect(() => {
		if (!layoutQuery.data) return;
		setWidthInput(layoutQuery.data.width);
		setHeightInput(layoutQuery.data.height);
	}, [layoutQuery.data]);

	useEffect(() => {
		let disposed = false;
		for (const tileset of TILESET_CONFIGS) {
			const image = new Image();
			image.src = tileset.src;
			image.onload = () => {
				if (disposed) return;
				const columns = Math.max(1, Math.floor(image.naturalWidth / 16));
				const rows = Math.max(1, Math.floor(image.naturalHeight / 16));
				const valid = image.naturalWidth >= 32 && image.naturalHeight >= 32;
				setAtlasSizeByTileset((prev) => ({
					...prev,
					[tileset.id]: { columns, rows },
				}));
				setTilesetInfoById((prev) => ({
					...prev,
					[tileset.id]: {
						width: image.naturalWidth,
						height: image.naturalHeight,
						valid,
						error: valid
							? undefined
							: "Tileset image too small. Expected spritesheet with many 16x16 tiles.",
					},
				}));
			};
			image.onerror = () => {
				if (disposed) return;
				setTilesetInfoById((prev) => ({
					...prev,
					[tileset.id]: {
						width: 0,
						height: 0,
						valid: false,
						error: `Failed to load ${tileset.src}`,
					},
				}));
			};
		}
		return () => {
			disposed = true;
		};
	}, []);

	const initOrResize = api.game.managerInitOrResizeOfficeLayout.useMutation({
		onSuccess: async () => {
			await Promise.all([
				utils.game.managerGetOfficeLayout.invalidate(),
				utils.game.managerListOfficesWithLayoutStatus.invalidate(),
			]);
			toast.success("Layout saved");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const setTile = api.game.managerSetTile.useMutation({
		onMutate: async (input) => {
			if (!selectedOfficeId) return { previousLayout: null as OfficeLayout | null };
			await utils.game.managerGetOfficeLayout.cancel({ officeId: selectedOfficeId });
			const previousLayout = utils.game.managerGetOfficeLayout.getData({
				officeId: selectedOfficeId,
			});
			if (!previousLayout) return { previousLayout };

			const key = getCellKey(input.x, input.y);
			const nextLayout: OfficeLayout = {
				...previousLayout,
				baseLayer:
					input.layer === "base"
						? { ...previousLayout.baseLayer, [key]: input.tile }
						: previousLayout.baseLayer,
				assetLayer:
					input.layer === "asset"
						? { ...previousLayout.assetLayer, [key]: input.tile }
						: previousLayout.assetLayer,
			};

			utils.game.managerGetOfficeLayout.setData({ officeId: selectedOfficeId }, nextLayout);
			return { previousLayout };
		},
		onError: (error, _input, context) => {
			if (selectedOfficeId && context?.previousLayout) {
				utils.game.managerGetOfficeLayout.setData(
					{ officeId: selectedOfficeId },
					context.previousLayout,
				);
			}
			toast.error(error.message);
		},
		onSettled: async () => {
			await utils.game.managerGetOfficeLayout.invalidate();
		},
	});

	const setTilesBatch = api.game.managerSetTilesBatch.useMutation({
		onMutate: async (input) => {
			if (!selectedOfficeId) return { previousLayout: null as OfficeLayout | null };
			await utils.game.managerGetOfficeLayout.cancel({ officeId: selectedOfficeId });
			const previousLayout = utils.game.managerGetOfficeLayout.getData({
				officeId: selectedOfficeId,
			});
			if (!previousLayout) return { previousLayout };

			const nextLayout: OfficeLayout = {
				...previousLayout,
				baseLayer: { ...previousLayout.baseLayer },
				assetLayer: { ...previousLayout.assetLayer },
			};

			for (const item of input.tiles) {
				const key = getCellKey(item.x, item.y);
				if (input.layer === "base") {
					nextLayout.baseLayer[key] = item.tile;
				} else {
					nextLayout.assetLayer[key] = item.tile;
				}
			}

			utils.game.managerGetOfficeLayout.setData({ officeId: selectedOfficeId }, nextLayout);
			return { previousLayout };
		},
		onError: (error, _input, context) => {
			if (selectedOfficeId && context?.previousLayout) {
				utils.game.managerGetOfficeLayout.setData(
					{ officeId: selectedOfficeId },
					context.previousLayout,
				);
			}
			toast.error(error.message);
		},
		onSettled: async () => {
			await utils.game.managerGetOfficeLayout.invalidate();
		},
	});

	const selectedTileset = TILESET_BY_ID[selectedTilesetId];
	const selectedTilesetInfo = tilesetInfoById[selectedTilesetId];
	const selectedTilesetValid = selectedTilesetInfo?.valid ?? true;
	const atlasSize = atlasSizeByTileset[selectedTilesetId] ?? {
		columns: selectedTileset.defaultColumns,
		rows: selectedTileset.defaultRows,
	};

	const pickerTiles = useMemo(() => {
		return Array.from({ length: atlasSize.columns * atlasSize.rows }, (_, index) => {
			const tileX = index % atlasSize.columns;
			const tileY = Math.floor(index / atlasSize.columns);
			return { tileX, tileY };
		});
	}, [atlasSize.columns, atlasSize.rows]);

	const rectangleCells = useMemo(() => {
		if (!dragStart || !dragCurrent) return [];
		return getRectangleCells(dragStart, dragCurrent);
	}, [dragStart, dragCurrent]);

	const previewKeys = useMemo(
		() => new Set(rectangleCells.map((cell) => getCellKey(cell.x, cell.y))),
		[rectangleCells],
	);

	const resetAreaPaint = () => {
		setIsAreaPainting(false);
		setDragStart(null);
		setDragCurrent(null);
	};

	const handleCreateOrResize = async () => {
		if (!selectedOfficeId) {
			toast.error("Select office first");
			return;
		}
		await initOrResize.mutateAsync({
			officeId: selectedOfficeId,
			width: widthInput,
			height: heightInput,
		});
	};

	const handleCellClick = async (x: number, y: number, metaKey: boolean) => {
		if (suppressNextClick) {
			setSuppressNextClick(false);
			return;
		}
		if (metaKey || isAreaPainting) return;
		if (!selectedOfficeId || !layoutQuery.data) return;
		await setTile.mutateAsync({
			officeId: selectedOfficeId,
			layer: selectedTileset.layer,
			x,
			y,
			tile: {
				tileset: selectedTilesetId,
				tileX: selectedTile.tileX,
				tileY: selectedTile.tileY,
			},
		});
	};

	const handleCellPointerDown = (x: number, y: number, metaKey: boolean) => {
		if (!metaKey) return;
		if (!selectedOfficeId || !layoutQuery.data) return;
		setSuppressNextClick(true);
		setIsAreaPainting(true);
		setDragStart({ x, y });
		setDragCurrent({ x, y });
	};

	const handleCellPointerEnter = (x: number, y: number) => {
		if (!isAreaPainting) return;
		setDragCurrent({ x, y });
	};

	const handleCellPointerUp = async (metaKey: boolean) => {
		if (!isAreaPainting) return;
		if (!metaKey) {
			resetAreaPaint();
			toast.info("Area paint canceled: Cmd released");
			window.setTimeout(() => setSuppressNextClick(false), 0);
			return;
		}
		if (!selectedOfficeId || !rectangleCells.length) {
			resetAreaPaint();
			window.setTimeout(() => setSuppressNextClick(false), 0);
			return;
		}

		const tiles = rectangleCells.map((cell) => ({
			x: cell.x,
			y: cell.y,
			tile: {
				tileset: selectedTilesetId,
				tileX: selectedTile.tileX,
				tileY: selectedTile.tileY,
			},
		}));
		try {
			await setTilesBatch.mutateAsync({
				officeId: selectedOfficeId,
				layer: selectedTileset.layer,
				tiles,
			});
			toast.success(`Painted ${tiles.length} tiles`);
		} finally {
			resetAreaPaint();
			window.setTimeout(() => setSuppressNextClick(false), 0);
		}
	};

	useEffect(() => {
		if (!isAreaPainting) return;
		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.key === "Meta") {
				resetAreaPaint();
				setSuppressNextClick(false);
				toast.info("Area paint canceled: Cmd released");
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				resetAreaPaint();
				setSuppressNextClick(false);
				toast.info("Area paint canceled");
			}
		};

		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isAreaPainting]);
	const hasOffices = (officeOptions.data?.length ?? 0) > 0;

	return (
		<ManagerPage
			title="Office Game Builder"
			description="Create office maps with floor and furniture tiles for game mode"
		>
			<div className="relative xl:min-h-[80vh]">
				<Card className="h-fit w-full xl:absolute xl:top-0 xl:left-0 xl:w-[480px]">
					<CardHeader>
						<CardTitle>Tileset menu</CardTitle>
						<CardDescription>Choose tiles and place them on the map.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex gap-2">
							{TILESET_CONFIGS.map((tileset) => (
								<Button
									key={tileset.id}
									type="button"
									variant={selectedTilesetId === tileset.id ? "default" : "outline"}
									size="sm"
									onClick={() => setSelectedTilesetId(tileset.id)}
								>
									{tileset.label}
								</Button>
							))}
						</div>
						<div className="rounded-md border p-2 text-xs text-muted-foreground">
							Layer target: <span className="font-medium text-foreground">{selectedTileset.layer}</span>
						</div>
						{selectedTilesetValid ? null : (
							<div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive">
								<p className="font-medium">
									Tileset file is invalid ({selectedTilesetInfo?.width ?? 0}x
									{selectedTilesetInfo?.height ?? 0}).
								</p>
								<p>
									Replace
									<span className="mx-1 font-mono">{selectedTileset.src}</span>
									with the real spritesheet PNG.
								</p>
								{selectedTilesetInfo?.error ? <p>{selectedTilesetInfo.error}</p> : null}
							</div>
						)}
						<div className="max-h-[72vh] overflow-auto rounded-md border p-2">
							{selectedTilesetValid ? (
								<div
									className="grid gap-1"
									style={{
										gridTemplateColumns: `repeat(${atlasSize.columns}, ${TILE_PREVIEW_SIZE}px)`,
										columnGap: `${TILE_PREVIEW_GAP}px`,
										rowGap: `${TILE_PREVIEW_GAP}px`,
									}}
								>
									{pickerTiles.map((tile) => {
										const isSelected =
											tile.tileX === selectedTile.tileX && tile.tileY === selectedTile.tileY;
										return (
											<button
												key={`${tile.tileX}-${tile.tileY}`}
												type="button"
												onClick={() => setSelectedTile(tile)}
												className={cn(
													"rounded border p-0",
													isSelected
														? "border-primary bg-primary/10"
														: "border-border hover:border-primary/50",
												)}
												aria-label={`Select tile ${tile.tileX}, ${tile.tileY}`}
											>
												<TileSprite
													tileset={selectedTilesetId}
													tileX={tile.tileX}
													tileY={tile.tileY}
													size={TILE_PREVIEW_SIZE}
												/>
											</button>
										);
									})}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									Tile picker disabled until a valid spritesheet is available.
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				<div className="space-y-4 xl:pl-[496px]">
					<Card>
						<CardHeader>
							<CardTitle>Layout setup</CardTitle>
							<CardDescription>Select office and configure map size in tiles.</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
							<Select value={selectedOfficeId} onValueChange={(value) => setSelectedOfficeId(value)}>
								<SelectTrigger>
									<SelectValue placeholder="Select office" />
								</SelectTrigger>
								<SelectContent>
									{(officeOptions.data ?? []).map((office) => (
										<SelectItem key={office.id} value={office.id}>
											{office.name}
											{office.hasLayout ? ` (${office.width}x${office.height})` : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								type="number"
								min={1}
								max={200}
								value={widthInput}
								onChange={(event) => setWidthInput(Number(event.target.value))}
								placeholder="Width"
							/>
							<Input
								type="number"
								min={1}
								max={200}
								value={heightInput}
								onChange={(event) => setHeightInput(Number(event.target.value))}
								placeholder="Height"
							/>
							<Button onClick={() => void handleCreateOrResize()} disabled={initOrResize.isPending}>
								{initOrResize.isPending ? "Saving..." : "Create / Resize"}
							</Button>
						</CardContent>
						<CardContent className="pt-0">
							{officeOptions.isError ? (
								<div className="space-y-1">
									<p className="text-sm text-destructive">
										Failed to load offices: {officeOptions.error.message}
									</p>
									{isMissingGameMigrationError(officeOptions.error.message) ? (
										<p className="text-xs text-muted-foreground">
											Game mode migration appears missing. Run{" "}
											<span className="font-mono">bun run db:migrate</span> and refresh.
										</p>
									) : null}
								</div>
							) : !hasOffices ? (
								<div className="space-y-3 rounded-md border border-dashed p-3">
									<p className="text-sm text-muted-foreground">
										No offices found. Create one here to start building.
									</p>
									<div className="flex max-w-md gap-2">
										<Input
											value={newOfficeName}
											onChange={(event) => setNewOfficeName(event.target.value)}
											placeholder="Office name"
										/>
										<Button
											onClick={() =>
												void createOffice.mutateAsync({
													name: newOfficeName.trim(),
												})
											}
											disabled={createOffice.isPending || !newOfficeName.trim()}
										>
											{createOffice.isPending ? "Creating..." : "Create office"}
										</Button>
									</div>
								</div>
							) : null}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Builder canvas</CardTitle>
							<CardDescription className="flex flex-wrap items-center justify-between gap-2">
								<span>
									Selected layer: <span className="font-medium">{selectedTileset.layer}</span> | Tile:{" "}
									({selectedTile.tileX}, {selectedTile.tileY})
								</span>
								<span className="text-xs">
									{isAreaPainting && dragStart && dragCurrent
										? `Area: ${Math.abs(dragCurrent.x - dragStart.x) + 1} x ${
												Math.abs(dragCurrent.y - dragStart.y) + 1
											} (${rectangleCells.length} tiles)`
										: "\u00A0"}
								</span>
							</CardDescription>
						</CardHeader>
						<CardContent className="overflow-auto">
							{layoutQuery.isLoading ? (
								<p className="text-sm text-muted-foreground">Loading layout...</p>
							) : !layoutQuery.data ? (
								<p className="text-sm text-muted-foreground">
									Select office and click Create / Resize to start.
								</p>
							) : (
								<OfficeLayoutGrid
									layout={layoutQuery.data}
									interactive
									onCellClick={handleCellClick}
									onCellPointerDown={handleCellPointerDown}
									onCellPointerEnter={handleCellPointerEnter}
									onCellPointerUp={(metaKey) => {
										void handleCellPointerUp(metaKey);
									}}
									previewKeys={previewKeys}
								/>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</ManagerPage>
	);
}
