import { assetRouter } from "~/server/api/routers/asset";
import { authRouter } from "~/server/api/routers/auth";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { employeeRouter } from "~/server/api/routers/employee";
import { gameRouter } from "~/server/api/routers/game";
import { locationRouter } from "~/server/api/routers/location";
import { verificationRouter } from "~/server/api/routers/verification";
import { createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	location: locationRouter,
	game: gameRouter,
	employee: employeeRouter,
	asset: assetRouter,
	verification: verificationRouter,
	dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
