import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
	isUniqueConstraintError,
	throwFormError,
} from "~/server/api/form-error";
import {
	createTRPCRouter,
	managerProcedure,
	protectedProcedure,
} from "~/server/api/trpc";
import { assets, assignmentHistory } from "~/server/db/schema";
import { AssetStatus } from "~/types/contracts";

const DEFAULT_ASSET_CATEGORIES = [
	"Furniture",
	"Electronics",
	"IT Equipment",
	"Mobile Device",
	"Networking",
	"Office Supplies",
];

const listInput = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(20),
	search: z.string().optional(),
	employeeId: z.string().optional(),
	roomId: z.string().optional(),
	category: z.string().optional(),
	status: z.nativeEnum(AssetStatus).optional(),
	includeRetired: z.boolean().optional(),
});

export const reassignInputSchema = z.object({
	assetId: z.string(),
	toEmployeeId: z.string(),
	toRoomId: z.string(),
	note: z.string().max(500).optional(),
});

export function isNoOpReassignment(
	currentEmployeeId: string | null,
	currentRoomId: string | null,
	toEmployeeId: string,
	toRoomId: string,
) {
	return currentEmployeeId === toEmployeeId && currentRoomId === toRoomId;
}

export const assetRouter = createTRPCRouter({
	categoryOptions: protectedProcedure.query(async ({ ctx }) => {
		const companyId = ctx.user.companyId;
		const defaults = DEFAULT_ASSET_CATEGORIES;
		if (!companyId) {
			return { defaults, existing: [], merged: defaults };
		}

		const rows = await ctx.db
			.select({ category: assets.category })
			.from(assets)
			.where(eq(assets.companyId, companyId))
			.groupBy(assets.category)
			.orderBy(asc(assets.category));

		const existing = rows
			.map((row) => row.category.trim())
			.filter((category) => category.length > 0);

		const mergedMap = new Map<string, string>();
		for (const category of [...defaults, ...existing]) {
			const key = category.trim().toLowerCase();
			if (!key || mergedMap.has(key)) continue;
			mergedMap.set(key, category.trim());
		}

		return {
			defaults,
			existing,
			merged: Array.from(mergedMap.values()),
		};
	}),

	list: protectedProcedure
		.input(listInput.optional())
		.query(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			if (!companyId) {
				return { items: [], total: 0, page: 1, pageSize: 20 };
			}

			const page = input?.page ?? 1;
			const pageSize = input?.pageSize ?? 20;
			const search = input?.search?.trim();

			const filters = [eq(assets.companyId, companyId)];
			if (input?.employeeId)
				filters.push(eq(assets.currentEmployeeId, input.employeeId));
			if (input?.roomId) filters.push(eq(assets.currentRoomId, input.roomId));
			if (input?.category) filters.push(eq(assets.category, input.category));
			if (input?.status) filters.push(eq(assets.status, input.status));
			if (!input?.includeRetired && !input?.status) {
				filters.push(sql`${assets.status} != ${AssetStatus.RETIRED}`);
			}

			if (search) {
				const searchFilter = or(
					like(assets.name, `%${search}%`),
					like(assets.barcode, `%${search}%`),
				);
				if (searchFilter) filters.push(searchFilter);
			}

			const where = and(...filters);

			const [items, totalRows] = await Promise.all([
				ctx.db
					.select()
					.from(assets)
					.where(where)
					.orderBy(asc(assets.name))
					.limit(pageSize)
					.offset((page - 1) * pageSize),
				ctx.db
					.select({ count: sql<number>`count(*)` })
					.from(assets)
					.where(where),
			]);

			return {
				items,
				total: totalRows[0]?.count ?? 0,
				page,
				pageSize,
			};
		}),

	myAssets: protectedProcedure.query(async ({ ctx }) => {
		const companyId = ctx.user.companyId;
		if (!companyId) return [];

		const employee = await ctx.db.query.employees.findFirst({
			where: (t, { and, eq }) =>
				and(
					eq(t.companyId, companyId),
					eq(t.userId, ctx.user.id),
					eq(t.isActive, true),
				),
		});

		if (!employee) return [];

		return ctx.db.query.assets.findMany({
			where: (t, { and, eq }) =>
				and(
					eq(t.companyId, companyId),
					eq(t.currentEmployeeId, employee.id),
					sql`${t.status} != ${AssetStatus.RETIRED}`,
				),
			orderBy: (t, { asc }) => [asc(t.name)],
		});
	}),

	create: managerProcedure
		.input(
			z.object({
				barcode: z.string().min(1).max(255),
				name: z.string().min(1).max(255),
				category: z.string().min(1).max(255),
				tags: z.array(z.string().min(1).max(50)).default([]),
				currentEmployeeId: z.string().optional(),
				currentRoomId: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const normalizedCategory = input.category.trim();

			if (normalizedCategory.length === 0) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						category: "Category is required.",
					},
				});
			}

			const currentEmployeeId = input.currentEmployeeId;
			if (currentEmployeeId) {
				const employee = await ctx.db.query.employees.findFirst({
					where: (t, { and, eq }) =>
						and(
							eq(t.id, currentEmployeeId),
							eq(t.companyId, companyId),
							eq(t.isActive, true),
						),
				});

				if (!employee) {
					throwFormError({
						formError: "Selected employee was not found.",
						fieldErrors: {
							currentEmployeeId: "Selected employee was not found.",
						},
					});
				}
			}

			const currentRoomId = input.currentRoomId;
			if (currentRoomId) {
				const room = await ctx.db.query.rooms.findFirst({
					where: (t, { and, eq }) =>
						and(eq(t.id, currentRoomId), eq(t.companyId, companyId)),
				});

				if (!room) {
					throwFormError({
						formError: "Selected room was not found.",
						fieldErrors: {
							currentRoomId: "Selected room was not found.",
						},
					});
				}
			}

			try {
				const [asset] = await ctx.db
					.insert(assets)
					.values({
						companyId,
						barcode: input.barcode,
						name: input.name,
						category: normalizedCategory,
						tags: JSON.stringify(input.tags),
						status: AssetStatus.ACTIVE,
						currentEmployeeId,
						currentRoomId,
						notes: input.notes,
					})
					.returning();

				return asset;
			} catch (error) {
				if (
					isUniqueConstraintError(error, [
						"sdhinventory_asset.company_id",
						"sdhinventory_asset.barcode",
					])
				) {
					throwFormError({
						formError: "Please fix highlighted fields.",
						fieldErrors: {
							barcode: "Barcode already exists in your company.",
						},
					});
				}

				throwFormError({
					formError: "Failed to create asset.",
				});
			}
		}),

	updateStatus: managerProcedure
		.input(
			z.object({
				assetId: z.string(),
				status: z.nativeEnum(AssetStatus),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(assets)
				.set({ status: input.status })
				.where(
					and(
						eq(assets.id, input.assetId),
						eq(assets.companyId, ctx.user.companyId),
					),
				);

			return { ok: true };
		}),

	remove: managerProcedure
		.input(
			z.object({
				assetId: z.string(),
				note: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const asset = await ctx.db.query.assets.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.assetId), eq(t.companyId, companyId)),
			});

			if (!asset) {
				throwFormError({
					formError: "Asset not found",
					fieldErrors: {
						assetId: "Asset not found.",
					},
				});
			}

			await ctx.db
				.update(assets)
				.set({
					status: AssetStatus.RETIRED,
					currentEmployeeId: null,
					currentRoomId: null,
				})
				.where(and(eq(assets.id, asset.id), eq(assets.companyId, companyId)));

			await ctx.db.insert(assignmentHistory).values({
				companyId,
				assetId: asset.id,
				fromEmployeeId: asset.currentEmployeeId,
				toEmployeeId: null,
				fromRoomId: asset.currentRoomId,
				toRoomId: null,
				changedByUserId: ctx.user.id,
				note: input.note ?? "Asset removed",
			});

			return { ok: true };
		}),

	restore: managerProcedure
		.input(
			z.object({
				assetId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const asset = await ctx.db.query.assets.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.assetId), eq(t.companyId, companyId)),
			});

			if (!asset) {
				throwFormError({
					formError: "Asset not found",
					fieldErrors: {
						assetId: "Asset not found.",
					},
				});
			}

			await ctx.db
				.update(assets)
				.set({
					status: AssetStatus.ACTIVE,
					currentEmployeeId: null,
					currentRoomId: null,
				})
				.where(and(eq(assets.id, asset.id), eq(assets.companyId, companyId)));

			return { ok: true };
		}),

	reassign: managerProcedure
		.input(reassignInputSchema)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const asset = await ctx.db.query.assets.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.assetId), eq(t.companyId, companyId)),
			});

			if (!asset) {
				throwFormError({
					formError: "Asset not found",
					fieldErrors: {
						assetId: "Asset not found.",
					},
				});
			}

			const toEmployeeId = input.toEmployeeId;
			const employee = await ctx.db.query.employees.findFirst({
				where: (t, { and, eq }) =>
					and(
						eq(t.id, toEmployeeId),
						eq(t.companyId, companyId),
						eq(t.isActive, true),
					),
			});

			if (!employee) {
				throwFormError({
					formError: "Employee not found",
					fieldErrors: {
						toEmployeeId: "Selected employee was not found.",
					},
				});
			}

			const toRoomId = input.toRoomId;
			const room = await ctx.db.query.rooms.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, toRoomId), eq(t.companyId, companyId)),
			});

			if (!room) {
				throwFormError({
					formError: "Room not found",
					fieldErrors: {
						toRoomId: "Selected room was not found.",
					},
				});
			}

			if (
				isNoOpReassignment(
					asset.currentEmployeeId,
					asset.currentRoomId,
					toEmployeeId,
					toRoomId,
				)
			) {
				throwFormError({
					formError: "Asset is already assigned to this employee and room",
					fieldErrors: {
						toEmployeeId:
							"Asset is already assigned to this employee and room.",
						toRoomId: "Asset is already assigned to this employee and room.",
					},
				});
			}

			await ctx.db
				.update(assets)
				.set({
					currentEmployeeId: toEmployeeId,
					currentRoomId: toRoomId,
				})
				.where(
					and(eq(assets.id, input.assetId), eq(assets.companyId, companyId)),
				);

			await ctx.db.insert(assignmentHistory).values({
				companyId,
				assetId: asset.id,
				fromEmployeeId: asset.currentEmployeeId,
				toEmployeeId,
				fromRoomId: asset.currentRoomId,
				toRoomId,
				changedByUserId: ctx.user.id,
				note: input.note,
			});

			return { ok: true };
		}),

	history: protectedProcedure
		.input(z.object({ assetId: z.string() }))
		.query(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			if (!companyId) return [];

			return ctx.db.query.assignmentHistory.findMany({
				where: (t, { and, eq }) =>
					and(eq(t.companyId, companyId), eq(t.assetId, input.assetId)),
				orderBy: (t, { desc }) => [desc(t.createdAt)],
			});
		}),
});
