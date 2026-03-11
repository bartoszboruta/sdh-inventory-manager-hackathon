"use client";

import { useTheme } from "~/features/theme/theme-provider";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
	const { theme, mounted } = useTheme();

	return (
		<Sonner
			position="top-right"
			richColors
			closeButton
			theme={mounted ? theme : "light"}
		/>
	);
}
