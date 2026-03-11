import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import { AppLoading } from "~/components/shared/app-loading";
import { ThemeToggle } from "~/components/shared/theme-toggle";
import { SignInPanel } from "~/features/auth/components/sign-in-panel";
import { getHomeRouteForRole } from "~/features/auth/routes";
import { api } from "~/utils/api";

function AuthenticatedLanding() {
	const router = useRouter();
	const me = api.auth.me.useQuery(undefined, {
		retry: 1,
	});

	useEffect(() => {
		if (!me.data) return;
		void router.replace(getHomeRouteForRole(me.data.role));
	}, [me.data, router]);

	if (me.isError) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background text-foreground">
				<div className="space-y-3 rounded-lg border border-border/70 bg-card/80 p-6 text-center">
					<p className="text-base font-medium">
						Session detected, but profile lookup failed.
					</p>
					<p className="text-sm text-muted-foreground">
						Refresh the page. If you are using a tunnel/proxy, ensure auth
						cookies are forwarded.
					</p>
				</div>
			</main>
		);
	}

	return <AppLoading title="Routing to your workspace" />;
}

export default function Home() {
	const { status } = useSession();

	return (
		<>
			<Head>
				<title>SDH Inventory</title>
				<meta name="description" content="Office inventory management" />
				<link rel="icon" href="/favicon.ico" />
			</Head>

			{status === "loading" ? <AppLoading title="Loading session" /> : null}

			{status === "unauthenticated" ? (
				<main className="min-h-screen bg-background text-foreground">
					<div className="mx-auto w-full max-w-7xl px-4 py-8">
						<div className="mb-4 flex justify-end">
							<ThemeToggle />
						</div>
						<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
							<div className="space-y-5 rounded-2xl border border-border/70 bg-card/70 p-6 shadow-xl backdrop-blur md:p-8">
								<p className="inline-flex rounded-full border border-border/70 bg-secondary/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
									Command surface
								</p>
								<h1 className="text-6xl leading-[0.9] tracking-tight md:text-7xl">
									SDH Inventory Operations
								</h1>
								<p className="max-w-xl text-sm text-muted-foreground md:text-lg">
									Centralized equipment lifecycle management across employees,
									locations, and verification cycles.
								</p>
							</div>
							<SignInPanel />
						</div>
					</div>
				</main>
			) : null}

			{status === "authenticated" ? <AuthenticatedLanding /> : null}
		</>
	);
}
