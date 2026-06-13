import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/logs/:path*",
    "/alerts/:path*",
    "/projects/:path*",
    "/settings/:path*",
    "/billing/:path*",
  ],
};
