export type ServerFormErrors = {
	formError?: string;
	fieldErrors: Record<string, string>;
};

export const EMPTY_SERVER_ERRORS: ServerFormErrors = {
	fieldErrors: {},
};

export function extractServerFormErrors(error: unknown): ServerFormErrors {
	const source = error as
		| {
				data?: {
					formError?: { formError?: string; fieldErrors?: Record<string, string> };
					zodError?: { fieldErrors?: Record<string, string[]> };
				};
				shape?: {
					data?: {
						formError?: { formError?: string; fieldErrors?: Record<string, string> };
						zodError?: { fieldErrors?: Record<string, string[]> };
					};
				};
				message?: string;
		  }
		| undefined;

	const data = source?.data ?? source?.shape?.data;
	const formErrorData = source?.data?.formError ?? source?.shape?.data?.formError;
	const zodFieldErrors = data?.zodError?.fieldErrors ?? {};
	const normalizedZodErrors = Object.fromEntries(
		Object.entries(zodFieldErrors)
			.filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
			.map(([field, messages]) => [field, messages[0] ?? "Invalid value."]),
	) as Record<string, string>;

	if (formErrorData) {
		return {
			formError: formErrorData.formError,
			fieldErrors: {
				...normalizedZodErrors,
				...(formErrorData.fieldErrors ?? {}),
			},
		};
	}

	if (Object.keys(normalizedZodErrors).length > 0) {
		return {
			formError: "Please fix highlighted fields.",
			fieldErrors: normalizedZodErrors,
		};
	}

	return {
		formError: source?.message ?? "Request failed. Please try again.",
		fieldErrors: {},
	};
}

export function inputErrorClass(fieldError?: string): string {
	return fieldError
		? "border-destructive focus-visible:ring-destructive/20 focus-visible:ring-2"
		: "";
}
