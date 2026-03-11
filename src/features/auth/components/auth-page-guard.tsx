import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { type ReactNode, useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AppLoading } from "~/components/shared/app-loading";
import { UserRole } from "~/types/contracts";
import { api } from "~/utils/api";

import { type AppRole, getHomeRouteForRole } from "../routes";
import { BootstrapCompanyCard } from "./bootstrap-company-card";

type AuthPageGuardProps = {
	allowedRoles?: UserRole[];
	requireCompany?: boolean;
	children: (me: {
		id: string;
		email: string;
		name: string | null;
		role: AppRole;
		companyId: string | null;
	}) => ReactNode;
};

export function AuthPageGuard({
	allowedRoles,
	requireCompany = true,
	children,
}: AuthPageGuardProps) {
	const router = useRouter();
	const { status } = useSession();
	const me = api.auth.me.useQuery(undefined, {
		enabled: status === "authenticated",
	});

	useEffect(() => {
		if (status === "unauthenticated") {
			void router.replace("/");
		}
	}, [status, router]);

	if (status === "loading") {
		return <AppLoading title="Checking session" />;
	}

	if (status === "unauthenticated") {
		return <AppLoading title="Redirecting to sign in" />;
	}

	if (me.isLoading || !me.data) {
		return <AppLoading title="Loading profile" />;
	}

	if (allowedRoles && !allowedRoles.includes(me.data.role as UserRole)) {
		void router.replace(getHomeRouteForRole(me.data.role));
		return <AppLoading title="Redirecting" />;
	}

	if (
		requireCompany &&
		me.data.role === "OFFICE_MANAGER" &&
		!me.data.companyId
	) {
		return (
			<main className="min-h-screen bg-background text-foreground">
				<div className="mx-auto w-full max-w-7xl px-4 py-8">
					<BootstrapCompanyCard />
				</div>
			</main>
		);
	}

	if (!me.data.companyId && me.data.role === "EMPLOYEE") {
		return (
			<main className="min-h-screen bg-background text-foreground">
				<div className="mx-auto w-full max-w-4xl px-4 py-8">
					<Alert>
						<AlertTitle>No company assigned</AlertTitle>
						<AlertDescription>
							Your account is authenticated but not assigned to a company yet.
							Contact your office manager.
						</AlertDescription>
					</Alert>
				</div>
			</main>
		);
	}

	return <>{children(me.data)}</>;
}
