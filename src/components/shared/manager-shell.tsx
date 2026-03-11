import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import {
	Building2,
	ClipboardCheck,
	Gamepad2,
	LayoutDashboard,
	Laptop,
	Menu,
	Users,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import { ThemeToggle } from "~/components/shared/theme-toggle";
import { cn } from "~/lib/utils";
import { UserRole } from "~/types/contracts";

const managerNav = [
	{ href: "/dashboard", label: "Overview", icon: LayoutDashboard },
	{ href: "/assets", label: "Assets", icon: Laptop },
	{ href: "/employees", label: "Employees", icon: Users },
	{ href: "/locations", label: "Locations", icon: Building2 },
	{ href: "/verification", label: "Verification", icon: ClipboardCheck },
	{ href: "/game-builder", label: "Game Builder", icon: Gamepad2 },
] as const;

type ManagerShellProps = {
	me: {
		email: string;
		role: UserRole;
	};
	title: string;
	description: string;
	children: ReactNode;
};

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
	const router = useRouter();

	return (
		<nav className="grid gap-1">
			{managerNav.map((item) => {
				const isActive = router.pathname === item.href;
				const Icon = item.icon;
				return (
					<Link
						key={item.href}
						href={item.href}
						onClick={onNavigate}
						className={cn(
							"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
							isActive
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						<Icon className="h-4 w-4" />
						<span>{item.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}

export function ManagerShell({ me, title, description, children }: ManagerShellProps) {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[240px_1fr] md:py-6">
				<aside className="hidden rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur md:block">
					<div className="mb-4">
						<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
							SDH Inventory
						</p>
						<p className="text-xl leading-none text-primary">Manager Console</p>
					</div>
					<NavItems />
				</aside>

				<section className="space-y-4">
					<header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
						<div className="flex items-start gap-3">
							<Sheet>
								<SheetTrigger className="inline-flex size-8 items-center justify-center rounded-lg border border-input bg-background text-foreground hover:bg-muted md:hidden">
									<Menu className="h-4 w-4" />
								</SheetTrigger>
								<SheetContent side="left" className="w-72">
									<SheetHeader>
										<SheetTitle>Manager navigation</SheetTitle>
										<SheetDescription>
											Navigate between inventory domains.
										</SheetDescription>
									</SheetHeader>
									<div className="mt-6">
										<NavItems />
									</div>
								</SheetContent>
							</Sheet>

							<div>
								<h1 className="text-3xl leading-none md:text-4xl">{title}</h1>
								<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground md:text-sm md:normal-case md:tracking-normal">
									{description}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<ThemeToggle />
							<Badge variant="secondary">{me.role}</Badge>
							<span className="hidden text-sm text-muted-foreground lg:inline">
								{me.email}
							</span>
							<Button
								variant="outline"
								onClick={() => {
									void signOut({ callbackUrl: "/" });
								}}
							>
								Sign out
							</Button>
						</div>
					</header>

					<div className="space-y-4">{children}</div>
				</section>
			</div>
		</main>
	);
}
