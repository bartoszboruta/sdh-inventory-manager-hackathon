export type ComplianceInput = {
	totalEligible: number;
	verified: number;
	cycleClosed: boolean;
	cycleEnded: boolean;
};

export type ComplianceOutput = {
	verified: number;
	pending: number;
	expired: number;
};

export function computeCompliance(input: ComplianceInput): ComplianceOutput {
	const verified = Math.max(0, Math.min(input.verified, input.totalEligible));
	const pending = Math.max(0, input.totalEligible - verified);
	const expired = input.cycleClosed || input.cycleEnded ? pending : 0;

	return {
		verified,
		pending,
		expired,
	};
}
