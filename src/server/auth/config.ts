import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import {
	accounts,
	sessions,
	users,
	verificationTokens,
} from "~/server/db/schema";

declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
		} & DefaultSession["user"];
	}
}

const credentialsSchema = z.object({
	email: z.string().email(),
});

const providers: NextAuthConfig["providers"] = [
	Credentials({
		name: "Email",
		credentials: {
			email: { label: "Email", type: "email" },
		},
		authorize: async (credentials) => {
			const parsed = credentialsSchema.safeParse(credentials);
			if (!parsed.success) return null;

			const user = await db.query.users.findFirst({
				where: (u, { and, eq }) =>
					and(eq(u.email, parsed.data.email), eq(u.isActive, true)),
			});

			if (!user) return null;

			return {
				id: user.id,
				email: user.email,
				name: user.name,
				image: user.image,
			};
		},
	}),
];

if (env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) {
	providers.push(
		DiscordProvider({
			clientId: env.AUTH_DISCORD_ID,
			clientSecret: env.AUTH_DISCORD_SECRET,
		}),
	);
}

export const authConfig = {
	providers,
	trustHost: true,
	session: {
		strategy: "jwt",
	},
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens,
	}) as NextAuthConfig["adapter"],
	callbacks: {
		jwt: ({ token, user }) => {
			if (user?.id) {
				token.id = user.id;
			}

			return token;
		},
		session: ({ session, token, user }) => {
			const id =
				user?.id ??
				(typeof token.id === "string" ? token.id : undefined) ??
				token.sub;

			if (!id) {
				return session;
			}

			return {
				...session,
				user: {
					...session.user,
					id,
				},
			};
		},
	},
} satisfies NextAuthConfig;
