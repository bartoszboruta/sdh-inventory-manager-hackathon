import { Moon, Sun } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useTheme } from "~/features/theme/theme-provider";

export function ThemeToggle() {
	const { theme, toggleTheme, mounted } = useTheme();

	return (
		<Button
			type="button"
			variant="outline"
			size="icon-sm"
			onClick={toggleTheme}
			aria-label="Toggle dark mode"
			title={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
		>
			{mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
		</Button>
	);
}
