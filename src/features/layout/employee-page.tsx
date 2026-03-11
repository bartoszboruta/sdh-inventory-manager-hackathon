import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ThemeToggle } from "~/components/shared/theme-toggle";
import { UserRole } from "~/types/contracts";

import { AuthPageGuard } from "../auth/components/auth-page-guard";

type EmployeePageProps = {
	title: string;
	description: string;
	children: ReactNode;
};

export function EmployeePage({ title, description, children }: EmployeePageProps) {
	return (
		<AuthPageGuard allowedRoles={[UserRole.EMPLOYEE]} requireCompany>
			{(me) => (
				<main className="min-h-screen bg-background text-foreground">
					<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
						<Card className="flex flex-wrap items-start justify-between gap-3 border-border/70 bg-card/70 p-4 backdrop-blur">
							<div>
								<h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
								<p className="text-sm text-muted-foreground">{description}</p>
							</div>
							<div className="flex items-center gap-2">
								<ThemeToggle />
								<Badge variant="secondary">{me.role}</Badge>
								<Button variant="outline" onClick={() => void signOut({ callbackUrl: "/" })}>
									Sign out
								</Button>
							</div>
						</Card>
						{children}
					</div>
				</main>
			)}
		</AuthPageGuard>
	);
}
