import type { ReactNode } from "react";

import { ManagerShell } from "~/components/shared/manager-shell";
import { UserRole } from "~/types/contracts";

import { AuthPageGuard } from "../auth/components/auth-page-guard";

type ManagerPageProps = {
	title: string;
	description: string;
	children: ReactNode;
};

export function ManagerPage({ title, description, children }: ManagerPageProps) {
	return (
		<AuthPageGuard allowedRoles={[UserRole.OFFICE_MANAGER]} requireCompany>
			{(me) => (
				<ManagerShell
					me={{ email: me.email, role: UserRole.OFFICE_MANAGER }}
					title={title}
					description={description}
				>
					{children}
				</ManagerShell>
			)}
		</AuthPageGuard>
	);
}
