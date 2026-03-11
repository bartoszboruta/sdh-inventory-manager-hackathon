import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { getToken } from "next-auth/jwt";
import superjson from "superjson";
import { ZodError } from "zod";

import { env } from "~/env";
import { getFormErrorFromCause } from "~/server/api/form-error";
import { db } from "~/server/db";
import { UserRole } from "~/types/contracts";

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
	const forwardedProto = opts.req.headers["x-forwarded-proto"];
	const forwardedProtoValue = Array.isArray(forwardedProto)
		? forwardedProto.join(",")
		: (forwardedProto ?? "");
	const isForwardedHttps = forwardedProtoValue
		.toLowerCase()
		.split(",")
		.some((value) => value.trim() === "https");
	const cookieHeaderRaw = opts.req.headers.cookie;
	const cookieHeader = Array.isArray(cookieHeaderRaw)
		? cookieHeaderRaw.join("; ")
		: (cookieHeaderRaw ?? "");
	const hasSecureSessionCookie =
		cookieHeader.includes("__Secure-authjs.session-token") ||
		cookieHeader.includes("__Secure-next-auth.session-token");

	const headers = Object.fromEntries(
		Object.entries(opts.req.headers).map(([key, value]) => [
			key,
			Array.isArray(value) ? value.join(", ") : (value ?? ""),
		]),
	);

	const token = await getToken({
		req: { headers },
		secret: env.AUTH_SECRET,
		secureCookie: isForwardedHttps || hasSecureSessionCookie,
	});

	const userId =
		typeof token?.id === "string"
			? token.id
			: typeof token?.sub === "string"
				? token.sub
				: null;

	const session = userId
		? {
				user: {
					id: userId,
				},
			}
		: null;

	const user = userId
		? await db.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, userId),
			})
		: null;

	return {
		db,
		session,
		user,
	};
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
				formError: getFormErrorFromCause(error.cause),
			},
		};
	},
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session?.user || !ctx.user || !ctx.user.isActive) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	return next({
		ctx: {
			...ctx,
			session: ctx.session,
			user: ctx.user,
		},
	});
});

export const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.user.role !== UserRole.OFFICE_MANAGER) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}

	if (!ctx.user.companyId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "User is not assigned to company",
		});
	}

	return next({
		ctx: {
			...ctx,
			user: {
				...ctx.user,
				companyId: ctx.user.companyId,
			},
		},
	});
});
