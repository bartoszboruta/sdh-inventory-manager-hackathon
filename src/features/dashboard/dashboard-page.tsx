import Link from "next/link";

import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/utils/api";

import { ManagerPage } from "../layout/manager-page";

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border border-border/70 bg-muted/30 p-3">
			<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-1 text-2xl font-semibold">{value}</p>
		</div>
	);
}

export function DashboardPage() {
	const overview = api.dashboard.overview.useQuery();

	return (
		<ManagerPage
			title="Operations Overview"
			description="Live compliance and inventory health across your company"
		>
			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Inventory pulse</CardTitle>
						<CardDescription>
							High-signal inventory metrics for active operations.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
						{overview.isLoading ? (
							Array.from({ length: 6 }).map((_, index) => (
								<Skeleton key={index} className="h-20 w-full" />
							))
						) : (
							<>
								<Metric label="Total assets" value={overview.data?.totalAssets ?? 0} />
								<Metric label="Active" value={overview.data?.activeAssets ?? 0} />
								<Metric label="Broken" value={overview.data?.brokenAssets ?? 0} />
								<Metric label="Retired" value={overview.data?.retiredAssets ?? 0} />
								<Metric label="Verified" value={overview.data?.verified ?? 0} />
								<Metric label="Pending" value={overview.data?.pending ?? 0} />
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Current cycle</CardTitle>
						<CardDescription>
							Active compliance cycle and status.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						{overview.data?.currentCycle ? (
							<>
								<p className="font-medium">{overview.data.currentCycle.name}</p>
								<p className="text-muted-foreground">
									Status: {overview.data.currentCycle.status}
								</p>
								<p className="text-muted-foreground">
									Ends: {new Date(overview.data.currentCycle.endsAt).toLocaleString()}
								</p>
							</>
						) : (
							<p className="text-muted-foreground">No active cycle.</p>
						)}
						<Link
							href="/verification"
							className={buttonVariants({ variant: "outline", className: "w-full" })}
						>
							Open verification
						</Link>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Quick actions</CardTitle>
					<CardDescription>
						Navigate directly into operational domains.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Link href="/assets" className={buttonVariants()}>
						Manage assets
					</Link>
					<Link href="/employees" className={buttonVariants({ variant: "outline" })}>
						Manage employees
					</Link>
					<Link href="/locations" className={buttonVariants({ variant: "outline" })}>
						Manage locations
					</Link>
					<Link href="/verification" className={buttonVariants({ variant: "outline" })}>
						Manage verification
					</Link>
				</CardContent>
			</Card>
		</ManagerPage>
	);
}
