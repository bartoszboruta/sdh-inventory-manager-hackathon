import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function AppLoading({ title = "Loading" }: { title?: string }) {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8">
				<Card>
					<CardHeader>
						<CardTitle>{title}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-5 w-80" />
						<Skeleton className="h-36 w-full" />
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
