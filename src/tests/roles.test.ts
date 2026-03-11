import { describe, expect, it } from "vitest";

import { isManager } from "~/server/permissions/roles";
import { UserRole } from "~/types/contracts";

describe("isManager", () => {
	it("returns true for office manager", () => {
		expect(isManager(UserRole.OFFICE_MANAGER)).toBe(true);
	});

	it("returns false for employee", () => {
		expect(isManager(UserRole.EMPLOYEE)).toBe(false);
	});
});
