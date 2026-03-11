import { UserRole } from "~/types/contracts";

export function isManager(role: UserRole): boolean {
	return role === UserRole.OFFICE_MANAGER;
}
