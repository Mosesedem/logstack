import "next-auth";

declare module "next-auth" {
  interface User {
    accessToken: string;
    refreshToken: string;
    emailVerified?: boolean;
  }

  interface Session {
    accessToken: string;
    error?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      emailVerified?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    emailVerified?: boolean;
    error?: string;
  }
}
