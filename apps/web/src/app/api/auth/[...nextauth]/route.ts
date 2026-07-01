import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

const API_URL = process.env.API_URL || "http://localhost:8080";

// Token expiry time in milliseconds (15 minutes - matching backend)
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000;

// Refresh tokens at 80% of their lifetime (12 minutes)
const REFRESH_THRESHOLD = ACCESS_TOKEN_EXPIRY * 0.8;

async function refreshAccessToken(token: {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  [key: string]: unknown;
}) {
  try {
    const response = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const refreshedTokens = await response.json();

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken ?? token.refreshToken,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_EXPIRY,
      emailVerified: refreshedTokens.user?.emailVerified ?? token.emailVerified,
      error: undefined,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      accessTokenExpires: token.accessTokenExpires,
      emailVerified: token.emailVerified,
      error: "RefreshAccessTokenError",
    };
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${API_URL}/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            return null;
          }

          const data = await res.json();

          return {
            id: String(data.user.id),
            email: data.user.email,
            name: data.user.name,
            emailVerified: data.user.emailVerified,
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle OAuth sign in - sync user with backend
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          const res = await fetch(`${API_URL}/v1/auth/oauth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: account.provider,
              providerId: account.providerAccountId,
              email: user.email,
              name: user.name,
              image: user.image,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            user.accessToken = data.tokens.accessToken;
            user.refreshToken = data.tokens.refreshToken;
            user.emailVerified = data.user.emailVerified;
          }
        } catch (error) {
          console.error("OAuth sync error:", error);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        return {
          ...token,
          id: user.id,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_EXPIRY,
          emailVerified: user.emailVerified,
          error: undefined,
        };
      }

      // Return previous token if the access token has not expired yet
      // Check at 80% of lifetime (proactive refresh)
      if (
        token.accessToken &&
        token.refreshToken &&
        token.accessTokenExpires &&
        Date.now() <
          (token.accessTokenExpires as number) -
            (ACCESS_TOKEN_EXPIRY - REFRESH_THRESHOLD)
      ) {
        return token;
      }

      // Access token is about to expire or has expired, refresh it
      const refreshedToken = await refreshAccessToken(
        token as {
          accessToken: string;
          refreshToken: string;
          accessTokenExpires: number;
          [key: string]: unknown;
        },
      );

      // Ensure the returned object always has the required JWT properties
      return {
        ...token,
        accessToken: refreshedToken.accessToken,
        refreshToken: refreshedToken.refreshToken,
        accessTokenExpires: refreshedToken.accessTokenExpires,
        emailVerified: refreshedToken.emailVerified ?? token.emailVerified,
        error: refreshedToken.error,
      };
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      if (token.sub) {
        session.user.id = token.sub;
      } else if (token.id) {
        session.user.id = token.id as string;
      }
      session.user.emailVerified = token.emailVerified as boolean;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
