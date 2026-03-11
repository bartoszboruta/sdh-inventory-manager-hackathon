import type { LayerId, TilesetId } from "~/types/contracts";

export const TILE_SIZE = 16;

export type TilesetConfig = {
	id: TilesetId;
	label: string;
	layer: LayerId;
	src: string;
	defaultColumns: number;
	defaultRows: number;
};

export const TILESET_CONFIGS: TilesetConfig[] = [
	{
		id: "Room_Builder_Office_16x16",
		label: "Room Builder",
		layer: "base",
		src: "/tilesets/Room_Builder_Office_16x16.png",
		defaultColumns: 16,
		defaultRows: 11,
	},
	{
		id: "Modern_Office_Black_Shadow",
		label: "Modern Office",
		layer: "asset",
		src: "/tilesets/Modern_Office_Black_Shadow.png",
		defaultColumns: 16,
		defaultRows: 64,
	},
];

export const TILESET_BY_ID: Record<TilesetId, TilesetConfig> = {
	Room_Builder_Office_16x16: {
		id: "Room_Builder_Office_16x16",
		label: "Room Builder",
		layer: "base",
		src: "/tilesets/Room_Builder_Office_16x16.png",
		defaultColumns: 16,
		defaultRows: 11,
	},
	Modern_Office_Black_Shadow: {
		id: "Modern_Office_Black_Shadow",
		label: "Modern Office",
		layer: "asset",
		src: "/tilesets/Modern_Office_Black_Shadow.png",
		defaultColumns: 16,
		defaultRows: 64,
	},
};

export function getCellKey(x: number, y: number): string {
	return `${x},${y}`;
}
