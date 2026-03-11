import { UserRole } from "~/types/contracts";

export type AppRole = UserRole | "EMPLOYEE" | "OFFICE_MANAGER";

export function getHomeRouteForRole(role: AppRole): string {
	return role === UserRole.OFFICE_MANAGER ? "/dashboard" : "/my-assets";
}
