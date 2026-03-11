import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { throwFormError } from "~/server/api/form-error";
import {
	createTRPCRouter,
	managerProcedure,
	protectedProcedure,
} from "~/server/api/trpc";
import {
	assets,
	employees,
	verificationCycles,
	verificationEvents,
} from "~/server/db/schema";
import {
	AssetStatus,
	VerificationCycleStatus,
	VerificationMethod,
	VerificationResult,
} from "~/types/contracts";

const verifyAssetInput = z.object({
	cycleId: z.string(),
	assetId: z.string(),
	result: z.nativeEnum(VerificationResult),
	method: z.nativeEnum(VerificationMethod),
	officeId: z.string().optional(),
	floorId: z.string().optional(),
	roomId: z.string().optional(),
	note: z.string().max(500).optional(),
});

export const verificationRouter = createTRPCRouter({
	listCycles: protectedProcedure.query(async ({ ctx }) => {
		const companyId = ctx.user.companyId;
		if (!companyId) return [];

		return ctx.db.query.verificationCycles.findMany({
			where: (t, { eq }) => eq(t.companyId, companyId),
			orderBy: (t, { desc }) => [desc(t.startsAt)],
		});
	}),

	createCycle: managerProcedure
		.input(
			z.object({
				name: z.string().min(1).max(255),
				startsAt: z.date(),
				endsAt: z.date(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [cycle] = await ctx.db
				.insert(verificationCycles)
				.values({
					companyId: ctx.user.companyId,
					name: input.name,
					startsAt: input.startsAt,
					endsAt: input.endsAt,
					status: VerificationCycleStatus.PLANNED,
					createdByUserId: ctx.user.id,
				})
				.returning();

			return cycle;
		}),

	startCycle: managerProcedure
		.input(z.object({ cycleId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const cycle = await ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.cycleId), eq(t.companyId, companyId)),
			});

			if (!cycle) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						cycleId: "Cycle not found.",
					},
				});
			}

			if (cycle.status === VerificationCycleStatus.CLOSED) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						cycleId: "Closed cycle cannot be restarted.",
					},
				});
			}

			if (cycle.status === VerificationCycleStatus.ACTIVE) {
				return { ok: true };
			}

			const activeCycle = await ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(
						eq(t.companyId, companyId),
						eq(t.status, VerificationCycleStatus.ACTIVE),
					),
			});

			if (activeCycle && activeCycle.id !== input.cycleId) {
				throwFormError({
					formError:
						"Another verification cycle is already active. Close it before starting a new cycle.",
					fieldErrors: {
						cycleId:
							"Another verification cycle is already active. Close it first.",
					},
				});
			}

			await ctx.db
				.update(verificationCycles)
				.set({ status: VerificationCycleStatus.ACTIVE })
				.where(
					and(
						eq(verificationCycles.id, input.cycleId),
						eq(verificationCycles.companyId, companyId),
					),
				);

			return { ok: true };
		}),

	closeCycle: managerProcedure
		.input(z.object({ cycleId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(verificationCycles)
				.set({ status: VerificationCycleStatus.CLOSED })
				.where(
					and(
						eq(verificationCycles.id, input.cycleId),
						eq(verificationCycles.companyId, ctx.user.companyId),
					),
				);

			return { ok: true };
		}),

	verifyAsset: managerProcedure
		.input(verifyAssetInput)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;

			const cycle = await ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.cycleId), eq(t.companyId, companyId)),
			});

			if (!cycle) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						cycleId: "Cycle not found.",
					},
				});
			}
			if (cycle.status !== VerificationCycleStatus.ACTIVE) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						cycleId: "Cycle must be ACTIVE to verify assets.",
					},
				});
			}

			const asset = await ctx.db.query.assets.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.assetId), eq(t.companyId, companyId)),
			});

			if (!asset) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						assetId: "Asset not found.",
					},
				});
			}
			if (asset.status !== AssetStatus.ACTIVE) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						assetId: "Only ACTIVE assets are eligible for verification.",
					},
				});
			}
			if (!asset.currentEmployeeId) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						assetId:
							"Asset must be assigned to an active employee before verification.",
					},
				});
			}

			const [event] = await ctx.db
				.insert(verificationEvents)
				.values({
					companyId,
					cycleId: input.cycleId,
					assetId: input.assetId,
					verifiedByUserId: ctx.user.id,
					method: input.method,
					result: input.result,
					officeId: input.officeId,
					floorId: input.floorId,
					roomId: input.roomId,
					note: input.note,
				})
				.onConflictDoUpdate({
					target: [
						verificationEvents.companyId,
						verificationEvents.cycleId,
						verificationEvents.assetId,
					],
					set: {
						verifiedByUserId: ctx.user.id,
						method: input.method,
						result: input.result,
						officeId: input.officeId,
						floorId: input.floorId,
						roomId: input.roomId,
						note: input.note,
						createdAt: new Date(),
					},
				})
				.returning();

			return event;
		}),

	verifyAssetByBarcode: managerProcedure
		.input(
			z.object({
				cycleId: z.string(),
				barcode: z.string().min(1).max(255),
				note: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			const barcode = input.barcode.trim();

			const cycle = await ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.cycleId), eq(t.companyId, companyId)),
			});

			if (!cycle) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						cycleId: "Cycle not found.",
					},
				});
			}
			if (cycle.status !== VerificationCycleStatus.ACTIVE) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						cycleId: "Cycle must be ACTIVE to verify assets.",
					},
				});
			}

			const asset = await ctx.db.query.assets.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.companyId, companyId), eq(t.barcode, barcode)),
			});

			if (!asset) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						barcode: "No asset found for this barcode.",
					},
				});
			}
			if (asset.status !== AssetStatus.ACTIVE) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						barcode: "Only ACTIVE assets are eligible for verification.",
					},
				});
			}
			if (!asset.currentEmployeeId) {
				throwFormError({
					formError: "Please fix highlighted fields.",
					fieldErrors: {
						barcode:
							"Asset must be assigned to an active employee before verification.",
					},
				});
			}

			const existingEvent = await ctx.db.query.verificationEvents.findFirst({
				where: (t, { and, eq }) =>
					and(
						eq(t.companyId, companyId),
						eq(t.cycleId, input.cycleId),
						eq(t.assetId, asset.id),
					),
			});

			if (existingEvent?.result === VerificationResult.VERIFIED) {
				return {
					alreadyVerified: true,
					asset: {
						id: asset.id,
						name: asset.name,
						barcode: asset.barcode,
					},
				};
			}

			await ctx.db
				.insert(verificationEvents)
				.values({
					companyId,
					cycleId: input.cycleId,
					assetId: asset.id,
					verifiedByUserId: ctx.user.id,
					method: VerificationMethod.SCAN,
					result: VerificationResult.VERIFIED,
					roomId: asset.currentRoomId ?? undefined,
					note: input.note,
				})
				.onConflictDoUpdate({
					target: [
						verificationEvents.companyId,
						verificationEvents.cycleId,
						verificationEvents.assetId,
					],
					set: {
						verifiedByUserId: ctx.user.id,
						method: VerificationMethod.SCAN,
						result: VerificationResult.VERIFIED,
						roomId: asset.currentRoomId ?? undefined,
						note: input.note,
						createdAt: new Date(),
					},
				});

			return {
				alreadyVerified: false,
				asset: {
					id: asset.id,
					name: asset.name,
					barcode: asset.barcode,
				},
			};
		}),

	managerWorklist: managerProcedure
		.input(z.object({ employeeId: z.string().optional() }).optional())
		.query(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			if (!companyId) {
				return {
					activeCycle: null,
					employees: [],
					selectedEmployeeId: null,
					assets: [],
					eligibleEmployeeCount: 0,
					eligibleAssetCount: 0,
				};
			}

			const activeCycle = await ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(
						eq(t.companyId, companyId),
						eq(t.status, VerificationCycleStatus.ACTIVE),
					),
				orderBy: (t, { desc }) => [desc(t.startsAt)],
			});

			if (!activeCycle) {
				return {
					activeCycle: null,
					employees: [],
					selectedEmployeeId: null,
					assets: [],
					eligibleEmployeeCount: 0,
					eligibleAssetCount: 0,
				};
			}

			const [eligibleAssignments, activeEmployees] = await Promise.all([
				ctx.db
					.select({ employeeId: assets.currentEmployeeId })
					.from(assets)
					.where(
						and(
							eq(assets.companyId, companyId),
							eq(assets.status, AssetStatus.ACTIVE),
						),
					),
				ctx.db
					.select({
						id: employees.id,
						firstName: employees.firstName,
						lastName: employees.lastName,
						email: employees.email,
					})
					.from(employees)
					.where(
						and(
							eq(employees.companyId, companyId),
							eq(employees.isActive, true),
						),
					)
					.orderBy(employees.lastName, employees.firstName),
			]);

			const eligibleEmployeeIds = Array.from(
				new Set(
					eligibleAssignments
						.map((row) => row.employeeId)
						.filter((employeeId): employeeId is string => Boolean(employeeId)),
				),
			);
			const eligibleEmployees = activeEmployees.filter((employee) =>
				eligibleEmployeeIds.includes(employee.id),
			);
			const eligibleEmployeeCount = eligibleEmployees.length;
			const eligibleAssetCount = eligibleAssignments.filter((row) =>
				eligibleEmployeeIds.includes(row.employeeId ?? ""),
			).length;

			const selectedEmployeeId =
				input?.employeeId &&
				eligibleEmployees.some((employee) => employee.id === input.employeeId)
					? input.employeeId
					: eligibleEmployees[0]?.id;

			if (!selectedEmployeeId) {
				return {
					activeCycle,
					employees: eligibleEmployees,
					selectedEmployeeId: null,
					assets: [],
					eligibleEmployeeCount,
					eligibleAssetCount,
				};
			}

			const employeeAssets = await ctx.db.query.assets.findMany({
				where: (t, { and, eq }) =>
					and(
						eq(t.companyId, companyId),
						eq(t.currentEmployeeId, selectedEmployeeId),
						eq(t.status, AssetStatus.ACTIVE),
					),
				orderBy: (t, { asc }) => [asc(t.name)],
				with: {
					currentRoom: {
						columns: { id: true, name: true },
						with: {
							floor: {
								columns: { id: true, name: true },
								with: {
									office: {
										columns: { id: true, name: true },
									},
								},
							},
						},
					},
				},
			});

			const assetIds = employeeAssets.map((asset) => asset.id);
			if (assetIds.length === 0) {
				return {
					activeCycle,
					employees: eligibleEmployees,
					selectedEmployeeId,
					assets: [],
					eligibleEmployeeCount,
					eligibleAssetCount,
				};
			}

			const events = await ctx.db.query.verificationEvents.findMany({
				where: (t, { and, eq, inArray }) =>
					and(
						eq(t.companyId, companyId),
						eq(t.cycleId, activeCycle.id),
						inArray(t.assetId, assetIds),
					),
			});

			const eventByAssetId = new Map(
				events.map((event) => [event.assetId, event]),
			);

			return {
				activeCycle,
				employees: eligibleEmployees,
				selectedEmployeeId,
				eligibleEmployeeCount,
				eligibleAssetCount,
				assets: employeeAssets.map((asset) => {
					const event = eventByAssetId.get(asset.id);
					return {
						id: asset.id,
						name: asset.name,
						barcode: asset.barcode,
						category: asset.category,
						roomName: asset.currentRoom?.name ?? null,
						floorName: asset.currentRoom?.floor?.name ?? null,
						officeName: asset.currentRoom?.floor?.office?.name ?? null,
						status: event ? event.result : ("PENDING" as const),
						note: event?.note ?? null,
						updatedAt: event?.createdAt ?? null,
					};
				}),
			};
		}),

	cycleStats: protectedProcedure
		.input(z.object({ cycleId: z.string() }))
		.query(async ({ ctx, input }) => {
			const companyId = ctx.user.companyId;
			if (!companyId) {
				return { verified: 0, expired: 0, totalEligible: 0, pending: 0 };
			}

			const cycle = await ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.id, input.cycleId), eq(t.companyId, companyId)),
			});

			if (!cycle) {
				return { verified: 0, expired: 0, totalEligible: 0, pending: 0 };
			}

			const eligibleAssets = await ctx.db
				.select({ id: assets.id })
				.from(assets)
				.where(
					and(
						eq(assets.companyId, companyId),
						eq(assets.status, AssetStatus.ACTIVE),
					),
				);

			const eligibleIds = eligibleAssets.map((a) => a.id);
			if (eligibleIds.length === 0) {
				return { verified: 0, expired: 0, totalEligible: 0, pending: 0 };
			}

			const rows = await ctx.db
				.select({
					assetId: verificationEvents.assetId,
					result: verificationEvents.result,
				})
				.from(verificationEvents)
				.where(
					and(
						eq(verificationEvents.companyId, companyId),
						eq(verificationEvents.cycleId, input.cycleId),
						inArray(verificationEvents.assetId, eligibleIds),
					),
				);

			const reviewed = rows.length;
			const verified = rows.filter(
				(row) => row.result === VerificationResult.VERIFIED,
			).length;
			const totalEligible = eligibleIds.length;
			const pending = totalEligible - reviewed;
			const expired =
				cycle.status === VerificationCycleStatus.CLOSED ||
				cycle.endsAt <= new Date()
					? pending
					: 0;

			return { verified, expired, totalEligible, pending };
		}),
});
