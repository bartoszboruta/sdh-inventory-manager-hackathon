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
import { employees } from "~/server/db/schema";

const listInput = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(20),
	search: z.string().optional(),
});

export const employeeRouter = createTRPCRouter({
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

			const where = search
				? and(
						eq(employees.companyId, companyId),
						or(
							like(employees.firstName, `%${search}%`),
							like(employees.lastName, `%${search}%`),
							like(employees.email, `%${search}%`),
						),
					)
				: eq(employees.companyId, companyId);

			const [items, totalRows] = await Promise.all([
				ctx.db
					.select()
					.from(employees)
					.where(where)
					.orderBy(asc(employees.lastName), asc(employees.firstName))
					.limit(pageSize)
					.offset((page - 1) * pageSize),
				ctx.db
					.select({ count: sql<number>`count(*)` })
					.from(employees)
					.where(where),
			]);

			return {
				items,
				total: totalRows[0]?.count ?? 0,
				page,
				pageSize,
			};
		}),

	listAssignable: protectedProcedure.query(async ({ ctx }) => {
		const companyId = ctx.user.companyId;
		if (!companyId) return [];

		return ctx.db.query.employees.findMany({
			where: (t, { and, eq }) =>
				and(eq(t.companyId, companyId), eq(t.isActive, true)),
			orderBy: (t, { asc }) => [asc(t.lastName), asc(t.firstName)],
		});
	}),

	create: managerProcedure
		.input(
			z.object({
				firstName: z.string().min(1).max(255),
				lastName: z.string().min(1).max(255),
				email: z.string().email(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const [employee] = await ctx.db
					.insert(employees)
					.values({
						companyId: ctx.user.companyId,
						firstName: input.firstName,
						lastName: input.lastName,
						email: input.email,
					})
					.returning();

				return employee;
			} catch (error) {
				if (
					isUniqueConstraintError(error, [
						"sdhinventory_employee.company_id",
						"sdhinventory_employee.email",
					])
				) {
					throwFormError({
						formError: "Please fix highlighted fields.",
						fieldErrors: {
							email: "Employee with this email already exists in your company.",
						},
					});
				}

				throwFormError({
					formError: "Failed to create employee.",
				});
			}
		}),

	update: managerProcedure
		.input(
			z.object({
				id: z.string().min(1),
				firstName: z.string().min(1).max(255),
				lastName: z.string().min(1).max(255),
				email: z.string().email(),
				isActive: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(employees)
				.set({
					firstName: input.firstName,
					lastName: input.lastName,
					email: input.email,
					isActive: input.isActive,
				})
				.where(
					and(
						eq(employees.id, input.id),
						eq(employees.companyId, ctx.user.companyId),
					),
				);

			return { ok: true };
		}),
});
