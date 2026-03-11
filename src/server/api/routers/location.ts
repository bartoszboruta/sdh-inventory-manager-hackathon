import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { throwFormError } from "~/server/api/form-error";
import {
	createTRPCRouter,
	managerProcedure,
	protectedProcedure,
} from "~/server/api/trpc";
import { floors, offices, rooms } from "~/server/db/schema";
import { AssetStatus } from "~/types/contracts";

export const locationRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const companyId = ctx.user.companyId;
		if (!companyId) return { offices: [], floors: [], rooms: [] };

		const [officeRows, floorRows, roomRows] = await Promise.all([
			ctx.db.query.offices.findMany({
				where: (t, { eq }) => eq(t.companyId, companyId),
			}),
			ctx.db.query.floors.findMany({
				where: (t, { eq }) => eq(t.companyId, companyId),
			}),
			ctx.db.query.rooms.findMany({
				where: (t, { eq }) => eq(t.companyId, companyId),
			}),
		]);

		return {
			offices: officeRows,
			floors: floorRows,
			rooms: roomRows,
		};
	}),

	assetsByScope: protectedProcedure
		.input(
			z.object({
				scopeType: z.enum(["OFFICE", "FLOOR", "ROOM"]),
				scopeId: z.string().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			if (!companyId) return [];

			let roomIds: string[] = [];

			if (input.scopeType === "ROOM") {
				const room = await ctx.db.query.rooms.findFirst({
					where: (t, { and, eq }) =>
						and(eq(t.id, input.scopeId), eq(t.companyId, companyId)),
				});
				if (!room) return [];
				roomIds = [room.id];
			}

			if (input.scopeType === "FLOOR") {
				const floor = await ctx.db.query.floors.findFirst({
					where: (t, { and, eq }) =>
						and(eq(t.id, input.scopeId), eq(t.companyId, companyId)),
				});
				if (!floor) return [];

				const floorRooms = await ctx.db.query.rooms.findMany({
					where: (t, { and, eq }) =>
						and(eq(t.companyId, companyId), eq(t.floorId, floor.id)),
				});
				roomIds = floorRooms.map((room) => room.id);
			}

			if (input.scopeType === "OFFICE") {
				const office = await ctx.db.query.offices.findFirst({
					where: (t, { and, eq }) =>
						and(eq(t.id, input.scopeId), eq(t.companyId, companyId)),
				});
				if (!office) return [];

				const officeFloors = await ctx.db.query.floors.findMany({
					where: (t, { and, eq }) =>
						and(eq(t.companyId, companyId), eq(t.officeId, office.id)),
				});
				const floorIds = officeFloors.map((floor) => floor.id);
				if (!floorIds.length) return [];

				const officeRooms = await ctx.db.query.rooms.findMany({
					where: (t, { and, eq, inArray }) =>
						and(eq(t.companyId, companyId), inArray(t.floorId, floorIds)),
				});
				roomIds = officeRooms.map((room) => room.id);
			}

			if (!roomIds.length) return [];

			return ctx.db.query.assets.findMany({
				where: (t, { and, eq, inArray }) =>
					and(
						eq(t.companyId, companyId),
						inArray(t.currentRoomId, roomIds),
						sql`${t.status} != ${AssetStatus.RETIRED}`,
					),
				orderBy: (t, { asc }) => [asc(t.name)],
			});
		}),

	createOffice: managerProcedure
		.input(z.object({ name: z.string().min(1).max(255) }))
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const [office] = await ctx.db
				.insert(offices)
				.values({
					companyId,
					name: input.name,
				})
				.returning();

			return office;
		}),

	createFloor: managerProcedure
		.input(
			z.object({
				officeId: z.string().min(1),
				name: z.string().min(1).max(255),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const office = await ctx.db.query.offices.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.officeId), eq(t.companyId, companyId)),
			});

			if (!office) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						officeId: "Selected office was not found.",
					},
				});
			}

			const [floor] = await ctx.db
				.insert(floors)
				.values({
					companyId,
					officeId: input.officeId,
					name: input.name,
				})
				.returning();

			return floor;
		}),

	createRoom: managerProcedure
		.input(
			z.object({
				floorId: z.string().min(1),
				name: z.string().min(1).max(255),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const floor = await ctx.db.query.floors.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.floorId), eq(t.companyId, companyId)),
			});

			if (!floor) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						floorId: "Selected floor was not found.",
					},
				});
			}

			const [room] = await ctx.db
				.insert(rooms)
				.values({
					companyId,
					floorId: input.floorId,
					name: input.name,
				})
				.returning();

			return room;
		}),

	updateOffice: managerProcedure
		.input(z.object({ id: z.string(), name: z.string().min(1).max(255) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(offices)
				.set({ name: input.name })
				.where(
					and(
						eq(offices.id, input.id),
						eq(offices.companyId, ctx.user.companyId),
					),
				);

			return { ok: true };
		}),

	updateFloor: managerProcedure
		.input(z.object({ id: z.string(), name: z.string().min(1).max(255) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(floors)
				.set({ name: input.name })
				.where(
					and(
						eq(floors.id, input.id),
						eq(floors.companyId, ctx.user.companyId),
					),
				);

			return { ok: true };
		}),

	updateRoom: managerProcedure
		.input(z.object({ id: z.string(), name: z.string().min(1).max(255) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(rooms)
				.set({ name: input.name })
				.where(
					and(eq(rooms.id, input.id), eq(rooms.companyId, ctx.user.companyId)),
				);

			return { ok: true };
		}),
});
