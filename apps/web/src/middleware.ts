import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/overview/:path*",
    "/demo/:path*",
    "/logs/:path*",
    "/alerts/:path*",
    "/projects/:path*",
    "/create/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/checkout/:path*",
    "/admin/:path*",
  ],
};