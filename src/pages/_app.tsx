import type { AppType } from "next/app";
import { IBM_Plex_Sans, Teko } from "next/font/google";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "~/features/theme/theme-provider";
import { APIProvider } from "~/utils/api";
import "~/styles/globals.css";

const bodyFont = IBM_Plex_Sans({
	subsets: ["latin"],
	variable: "--font-body",
});

const displayFont = Teko({
	subsets: ["latin"],
	variable: "--font-display",
});

const MyApp: AppType<{ session: Session | null }> = ({
	Component,
	pageProps,
}) => {
	useEffect(() => {
		document.body.classList.add(
			bodyFont.className,
			bodyFont.variable,
			displayFont.variable,
		);
		return () => {
			document.body.classList.remove(
				bodyFont.className,
				bodyFont.variable,
				displayFont.variable,
			);
		};
	}, []);

	return (
		<SessionProvider session={pageProps.session}>
			<ThemeProvider>
				<APIProvider>
					<div
						className={`${bodyFont.variable} ${displayFont.variable} ${bodyFont.className}`}
					>
						<Component {...pageProps} />
						<Toaster />
					</div>
				</APIProvider>
			</ThemeProvider>
		</SessionProvider>
	);
};

export default MyApp;
