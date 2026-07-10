import "next-auth";

declare module "next-auth" {
  interface User {
    accessToken: string;
    refreshToken: string;
    emailVerified?: boolean;
    role?: string;
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
      role?: string;
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
    role?: string;
    error?: string;
  }
}
