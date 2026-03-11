export enum UserRole {
	EMPLOYEE = "EMPLOYEE",
	OFFICE_MANAGER = "OFFICE_MANAGER",
}

export type TenantScoped = {
	companyId: string;
};

export type PaginatedResult<T> = {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
};

export type ListQuery = {
	page?: number;
	pageSize?: number;
	search?: string;
	sortBy?: string;
	sortDir?: "asc" | "desc";
};

export enum AssetStatus {
	ACTIVE = "ACTIVE",
	BROKEN = "BROKEN",
	RETIRED = "RETIRED",
}

export enum VerificationMethod {
	SCAN = "SCAN",
	MANUAL = "MANUAL",
}

export enum VerificationResult {
	VERIFIED = "VERIFIED",
	NOT_VERIFIED = "NOT_VERIFIED",
}

export enum VerificationCycleStatus {
	PLANNED = "PLANNED",
	ACTIVE = "ACTIVE",
	CLOSED = "CLOSED",
}

export const TILESET_IDS = [
	"Room_Builder_Office_16x16",
	"Modern_Office_Black_Shadow",
] as const;

export type TilesetId = (typeof TILESET_IDS)[number];

export const LAYER_IDS = ["base", "asset"] as const;

export type LayerId = (typeof LAYER_IDS)[number];

export type PlacedTile = {
	tileset: TilesetId;
	tileX: number;
	tileY: number;
};

export type OfficeLayout = {
	officeId: string;
	width: number;
	height: number;
	baseLayer: Record<string, PlacedTile>;
	assetLayer: Record<string, PlacedTile>;
};
