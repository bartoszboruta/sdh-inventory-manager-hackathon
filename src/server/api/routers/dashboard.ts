import { and, count, eq, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assets, verificationEvents } from "~/server/db/schema";
import {
	AssetStatus,
	VerificationCycleStatus,
	VerificationResult,
} from "~/types/contracts";

export const dashboardRouter = createTRPCRouter({
	overview: protectedProcedure.query(async ({ ctx }) => {
		const companyId = ctx.user.companyId;
		if (!companyId) {
			return {
				totalAssets: 0,
				activeAssets: 0,
				brokenAssets: 0,
				retiredAssets: 0,
				currentCycle: null,
				verified: 0,
				pending: 0,
				expired: 0,
			};
		}

		const [
			totalAssetsRow,
			activeAssetsRow,
			brokenAssetsRow,
			retiredAssetsRow,
			currentCycle,
		] = await Promise.all([
			ctx.db
				.select({ value: count(assets.id) })
				.from(assets)
				.where(eq(assets.companyId, companyId)),
			ctx.db
				.select({ value: count(assets.id) })
				.from(assets)
				.where(
					and(
						eq(assets.companyId, companyId),
						eq(assets.status, AssetStatus.ACTIVE),
					),
				),
			ctx.db
				.select({ value: count(assets.id) })
				.from(assets)
				.where(
					and(
						eq(assets.companyId, companyId),
						eq(assets.status, AssetStatus.BROKEN),
					),
				),
			ctx.db
				.select({ value: count(assets.id) })
				.from(assets)
				.where(
					and(
						eq(assets.companyId, companyId),
						eq(assets.status, AssetStatus.RETIRED),
					),
				),
			ctx.db.query.verificationCycles.findFirst({
				where: (t, { and, eq }) =>
					and(
						eq(t.companyId, companyId),
						eq(t.status, VerificationCycleStatus.ACTIVE),
					),
				orderBy: (t, { desc }) => [desc(t.startsAt)],
			}),
		]);

		if (!currentCycle) {
			return {
				totalAssets: totalAssetsRow[0]?.value ?? 0,
				activeAssets: activeAssetsRow[0]?.value ?? 0,
				brokenAssets: brokenAssetsRow[0]?.value ?? 0,
				retiredAssets: retiredAssetsRow[0]?.value ?? 0,
				currentCycle: null,
				verified: 0,
				pending: 0,
				expired: 0,
			};
		}

		const [verifiedRows, reviewedRows, totalEligibleRows] = await Promise.all([
			ctx.db
				.select({
					value: sql<number>`count(distinct case when ${verificationEvents.result} = ${VerificationResult.VERIFIED} then ${verificationEvents.assetId} end)`,
				})
				.from(verificationEvents)
				.where(
					and(
						eq(verificationEvents.companyId, companyId),
						eq(verificationEvents.cycleId, currentCycle.id),
					),
				),
			ctx.db
				.select({
					value: sql<number>`count(distinct ${verificationEvents.assetId})`,
				})
				.from(verificationEvents)
				.where(
					and(
						eq(verificationEvents.companyId, companyId),
						eq(verificationEvents.cycleId, currentCycle.id),
					),
				),
			ctx.db
				.select({ value: count(assets.id) })
				.from(assets)
				.where(
					and(
						eq(assets.companyId, companyId),
						eq(assets.status, AssetStatus.ACTIVE),
					),
				),
		]);

		const verified = verifiedRows[0]?.value ?? 0;
		const totalEligible = totalEligibleRows[0]?.value ?? 0;
		const reviewed = reviewedRows[0]?.value ?? 0;
		const pending = totalEligible - reviewed;
		const expired =
			currentCycle.status === VerificationCycleStatus.CLOSED ||
			currentCycle.endsAt <= new Date()
				? pending
				: 0;

		return {
			totalAssets: totalAssetsRow[0]?.value ?? 0,
			activeAssets: activeAssetsRow[0]?.value ?? 0,
			brokenAssets: brokenAssetsRow[0]?.value ?? 0,
			retiredAssets: retiredAssetsRow[0]?.value ?? 0,
			currentCycle,
			verified,
			pending,
			expired,
		};
	}),
});
