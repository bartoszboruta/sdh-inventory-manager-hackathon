import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	createTRPCRouter,
	managerProcedure,
	protectedProcedure,
} from "~/server/api/trpc";
import { officeLayouts } from "~/server/db/schema";
import { LAYER_IDS, type PlacedTile, TILESET_IDS } from "~/types/contracts";

const OFFICE_TILESET = "Room_Builder_Office_16x16";
const ASSET_TILESET = "Modern_Office_Black_Shadow";

const setTileInputSchema = z.object({
	officeId: z.string().min(1),
	layer: z.enum(LAYER_IDS),
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	tile: z.object({
		tileset: z.enum(TILESET_IDS),
		tileX: z.number().int().min(0),
		tileY: z.number().int().min(0),
	}),
});

const setTilesBatchInputSchema = z.object({
	officeId: z.string().min(1),
	layer: z.enum(LAYER_IDS),
	tiles: z
		.array(
			z.object({
				x: z.number().int().min(0),
				y: z.number().int().min(0),
				tile: z.object({
					tileset: z.enum(TILESET_IDS),
					tileX: z.number().int().min(0),
					tileY: z.number().int().min(0),
				}),
			}),
		)
		.min(1)
		.max(5000),
});

function tileKey(x: number, y: number): string {
	return `${x},${y}`;
}

function validateLayerTileset(layer: "base" | "asset", tile: PlacedTile): void {
	if (layer === "base" && tile.tileset !== OFFICE_TILESET) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Base layer only accepts Room_Builder_Office_16x16 tiles",
		});
	}

	if (layer === "asset" && tile.tileset !== ASSET_TILESET) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Asset layer only accepts Modern_Office_Black_Shadow tiles",
		});
	}
}

function parseLayer(json: string): Record<string, PlacedTile> {
	try {
		const parsed = JSON.parse(json) as unknown;
		const schema = z.record(
			z.object({
				tileset: z.enum(TILESET_IDS),
				tileX: z.number().int().min(0),
				tileY: z.number().int().min(0),
			}),
		);
		return schema.parse(parsed);
	} catch {
		return {};
	}
}

function serializeLayer(layer: Record<string, PlacedTile>): string {
	return JSON.stringify(layer);
}

function trimLayerToBounds(
	layer: Record<string, PlacedTile>,
	width: number,
	height: number,
): Record<string, PlacedTile> {
	const next: Record<string, PlacedTile> = {};
	for (const [key, value] of Object.entries(layer)) {
		const [xRaw, yRaw] = key.split(",");
		const x = Number(xRaw);
		const y = Number(yRaw);
		if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
		if (x < 0 || y < 0) continue;
		if (x >= width || y >= height) continue;
		next[key] = value;
	}
	return next;
}

export const gameRouter = createTRPCRouter({
	managerListOfficesWithLayoutStatus: managerProcedure.query(
		async ({ ctx }) => {
			const companyId = ctx.user.companyId;
			const [officeRows, layoutRows] = await Promise.all([
				ctx.db.query.offices.findMany({
					where: (t, { eq }) => eq(t.companyId, companyId),
					orderBy: (t, { asc }) => [asc(t.name)],
				}),
				ctx.db.query.officeLayouts.findMany({
					where: (t, { eq }) => eq(t.companyId, companyId),
				}),
			]);

			const layoutByOfficeId = new Map(
				layoutRows.map((layout) => [layout.officeId, layout]),
			);
			return officeRows.map((office) => {
				const layout = layoutByOfficeId.get(office.id);
				return {
					id: office.id,
					name: office.name,
					hasLayout: Boolean(layout),
					width: layout?.width ?? null,
					height: layout?.height ?? null,
				};
			});
		},
	),

	managerGetOfficeLayout: managerProcedure
		.input(z.object({ officeId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const office = await ctx.db.query.offices.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.officeId), eq(t.companyId, companyId)),
			});
			if (!office) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Office not found" });
			}

			const layout = await ctx.db.query.officeLayouts.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.officeId, input.officeId), eq(t.companyId, companyId)),
			});

			if (!layout) return null;

			return {
				officeId: layout.officeId,
				width: layout.width,
				height: layout.height,
				baseLayer: parseLayer(layout.baseLayerJson),
				assetLayer: parseLayer(layout.assetLayerJson),
			};
		}),

	managerInitOrResizeOfficeLayout: managerProcedure
		.input(
			z.object({
				officeId: z.string().min(1),
				width: z.number().int().min(1).max(200),
				height: z.number().int().min(1).max(200),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const office = await ctx.db.query.offices.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.officeId), eq(t.companyId, companyId)),
			});
			if (!office) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Office not found" });
			}

			const existing = await ctx.db.query.officeLayouts.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.officeId, input.officeId), eq(t.companyId, companyId)),
			});

			if (!existing) {
				const [created] = await ctx.db
					.insert(officeLayouts)
					.values({
						companyId,
						officeId: input.officeId,
						width: input.width,
						height: input.height,
						baseLayerJson: "{}",
						assetLayerJson: "{}",
					})
					.returning();
				if (!created) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create office layout",
					});
				}

				return {
					officeId: created.officeId,
					width: created.width,
					height: created.height,
					baseLayer: {},
					assetLayer: {},
				};
			}

			const nextBase = trimLayerToBounds(
				parseLayer(existing.baseLayerJson),
				input.width,
				input.height,
			);
			const nextAsset = trimLayerToBounds(
				parseLayer(existing.assetLayerJson),
				input.width,
				input.height,
			);

			const [updated] = await ctx.db
				.update(officeLayouts)
				.set({
					width: input.width,
					height: input.height,
					baseLayerJson: serializeLayer(nextBase),
					assetLayerJson: serializeLayer(nextAsset),
				})
				.where(
					and(
						eq(officeLayouts.companyId, companyId),
						eq(officeLayouts.officeId, input.officeId),
					),
				)
				.returning();
			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to resize office layout",
				});
			}

			return {
				officeId: updated.officeId,
				width: updated.width,
				height: updated.height,
				baseLayer: nextBase,
				assetLayer: nextAsset,
			};
		}),

	managerSetTile: managerProcedure
		.input(setTileInputSchema)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const layout = await ctx.db.query.officeLayouts.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.officeId, input.officeId), eq(t.companyId, companyId)),
			});
			if (!layout) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Layout not found. Initialize office layout first.",
				});
			}

			if (input.x >= layout.width || input.y >= layout.height) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Tile coordinates out of bounds",
				});
			}

			validateLayerTileset(input.layer, input.tile);

			const baseLayer = parseLayer(layout.baseLayerJson);
			const assetLayer = parseLayer(layout.assetLayerJson);
			const key = tileKey(input.x, input.y);
			if (input.layer === "base") {
				baseLayer[key] = input.tile;
			} else {
				assetLayer[key] = input.tile;
			}

			const [updated] = await ctx.db
				.update(officeLayouts)
				.set({
					baseLayerJson: serializeLayer(baseLayer),
					assetLayerJson: serializeLayer(assetLayer),
				})
				.where(
					and(
						eq(officeLayouts.companyId, companyId),
						eq(officeLayouts.officeId, input.officeId),
					),
				)
				.returning();
			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save tile",
				});
			}

			return {
				officeId: updated.officeId,
				width: updated.width,
				height: updated.height,
				baseLayer,
				assetLayer,
			};
		}),

	managerSetTilesBatch: managerProcedure
		.input(setTilesBatchInputSchema)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const layout = await ctx.db.query.officeLayouts.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.officeId, input.officeId), eq(t.companyId, companyId)),
			});
			if (!layout) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Layout not found. Initialize office layout first.",
				});
			}

			for (const item of input.tiles) {
				if (item.x >= layout.width || item.y >= layout.height) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Tile coordinates out of bounds",
					});
				}
				validateLayerTileset(input.layer, item.tile);
			}

			const baseLayer = parseLayer(layout.baseLayerJson);
			const assetLayer = parseLayer(layout.assetLayerJson);
			for (const item of input.tiles) {
				const key = tileKey(item.x, item.y);
				if (input.layer === "base") {
					baseLayer[key] = item.tile;
				} else {
					assetLayer[key] = item.tile;
				}
			}

			const [updated] = await ctx.db
				.update(officeLayouts)
				.set({
					baseLayerJson: serializeLayer(baseLayer),
					assetLayerJson: serializeLayer(assetLayer),
				})
				.where(
					and(
						eq(officeLayouts.companyId, companyId),
						eq(officeLayouts.officeId, input.officeId),
					),
				)
				.returning();
			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save tiles batch",
				});
			}

			return {
				officeId: updated.officeId,
				width: updated.width,
				height: updated.height,
				baseLayer,
				assetLayer,
			};
		}),

	employeeListAvailableOfficeLayouts: protectedProcedure.query(
		async ({ ctx }) => {
			if (!ctx.user.companyId) return [];

			const companyId = ctx.user.companyId;
			const layouts = await ctx.db.query.officeLayouts.findMany({
				where: (t, { eq }) => eq(t.companyId, companyId),
				orderBy: (t, { asc }) => [asc(t.officeId)],
			});
			if (!layouts.length) return [];

			const officeIds = layouts.map((layout) => layout.officeId);
			const officeRows = await ctx.db.query.offices.findMany({
				where: (t, { and, eq, inArray }) =>
					and(eq(t.companyId, companyId), inArray(t.id, officeIds)),
			});
			const officeById = new Map(
				officeRows.map((office) => [office.id, office]),
			);

			return layouts
				.map((layout) => {
					const office = officeById.get(layout.officeId);
					if (!office) return null;
					return {
						officeId: layout.officeId,
						officeName: office.name,
						width: layout.width,
						height: layout.height,
					};
				})
				.filter((item): item is NonNullable<typeof item> => Boolean(item))
				.sort((a, b) => a.officeName.localeCompare(b.officeName));
		},
	),

	employeeGetOfficeLayout: protectedProcedure
		.input(z.object({ officeId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			if (!ctx.user.companyId) return null;

			const companyId = ctx.user.companyId;
			const office = await ctx.db.query.offices.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.officeId), eq(t.companyId, companyId)),
			});
			if (!office) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Office not found" });
			}

			const layout = await ctx.db.query.officeLayouts.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.officeId, input.officeId), eq(t.companyId, companyId)),
			});
			if (!layout) return null;

			return {
				officeId: layout.officeId,
				width: layout.width,
				height: layout.height,
				baseLayer: parseLayer(layout.baseLayerJson),
				assetLayer: parseLayer(layout.assetLayerJson),
			};
		}),
});
