import { describe, expect, it } from "vitest";

import { computeCompliance } from "~/features/verification/compliance";

describe("computeCompliance", () => {
	it("marks pending as expired when cycle is closed", () => {
		expect(
			computeCompliance({
				totalEligible: 10,
				verified: 6,
				cycleClosed: true,
				cycleEnded: false,
			}),
		).toEqual({ verified: 6, pending: 4, expired: 4 });
	});

	it("does not expire pending assets during active cycle", () => {
		expect(
			computeCompliance({
				totalEligible: 10,
				verified: 6,
				cycleClosed: false,
				cycleEnded: false,
			}),
		).toEqual({ verified: 6, pending: 4, expired: 0 });
	});
});
