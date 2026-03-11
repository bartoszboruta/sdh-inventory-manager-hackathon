import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
	mounted: boolean;
};

const STORAGE_KEY = "sdh-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
}

function getPreferredTheme(): Theme {
	if (typeof window === "undefined") return "light";
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [mounted, setMounted] = useState(false);
	const [theme, setThemeState] = useState<Theme>("light");

	useEffect(() => {
		const initialTheme = getPreferredTheme();
		setThemeState(initialTheme);
		applyTheme(initialTheme);
		setMounted(true);
	}, []);

	const setTheme = (nextTheme: Theme) => {
		setThemeState(nextTheme);
		applyTheme(nextTheme);
		window.localStorage.setItem(STORAGE_KEY, nextTheme);
	};

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			setTheme,
			toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
			mounted,
		}),
		[theme, mounted],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return ctx;
}
