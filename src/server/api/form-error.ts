import { TRPCError } from "@trpc/server";

export type FormErrorData = {
	formError?: string;
	fieldErrors?: Record<string, string>;
};

export function throwFormError({
	formError,
	fieldErrors,
}: FormErrorData): never {
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: formError ?? "Invalid request",
		cause: {
			formError,
			fieldErrors,
		},
	});
}

export function isUniqueConstraintError(
	error: unknown,
	fragments: string[],
): boolean {
	if (!(error instanceof Error)) return false;
	if (!error.message.includes("UNIQUE constraint failed")) return false;
	return fragments.every((fragment) => error.message.includes(fragment));
}

export function getFormErrorFromCause(cause: unknown): FormErrorData | null {
	if (!cause || typeof cause !== "object") return null;
	const value = cause as { formError?: unknown; fieldErrors?: unknown };
	const formError =
		typeof value.formError === "string" ? value.formError : undefined;
	const fieldErrors =
		value.fieldErrors && typeof value.fieldErrors === "object"
			? (Object.fromEntries(
					Object.entries(value.fieldErrors).filter(
						([, v]) => typeof v === "string",
					),
				) as Record<string, string>)
			: undefined;

	if (!formError && (!fieldErrors || Object.keys(fieldErrors).length === 0)) {
		return null;
	}

	return {
		formError,
		fieldErrors,
	};
}
