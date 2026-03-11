import { eq } from "drizzle-orm";
import { z } from "zod";

import { throwFormError } from "~/server/api/form-error";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { companies, users } from "~/server/db/schema";
import { UserRole } from "~/types/contracts";

export const authRouter = createTRPCRouter({
	me: protectedProcedure.query(async ({ ctx }) => {
		return {
			id: ctx.user.id,
			email: ctx.user.email,
			name: ctx.user.name,
			role: ctx.user.role,
			companyId: ctx.user.companyId,
			user: ctx.user,
		};
	}),

	bootstrapManager: protectedProcedure
		.input(
			z.object({
				companyName: z.string().min(2).max(255),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			let companyId = ctx.user.companyId;

			if (!companyId) {
				const [company] = await ctx.db
					.insert(companies)
					.values({ name: input.companyName })
					.returning({ id: companies.id });

				companyId = company?.id ?? null;
			}

			if (!companyId) {
				throwFormError({
					formError: "Failed to create company.",
				});
			}

			await ctx.db
				.update(users)
				.set({
					companyId,
					role: UserRole.OFFICE_MANAGER,
					isActive: true,
				})
				.where(eq(users.id, ctx.user.id));

			return {
				ok: true,
				companyId,
				role: UserRole.OFFICE_MANAGER,
			};
		}),
});
