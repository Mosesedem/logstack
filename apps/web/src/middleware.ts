import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
    const isAdmin = token?.role === "admin";

    // Non-admins cannot open the admin dashboard
    if (isAdminRoute && !isAdmin) {
      const dest = token ? "/overview" : "/login";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // Signed-in users hitting auth pages go to their home
    if (token && (path === "/login" || path === "/signup")) {
      const dest = isAdmin ? "/admin" : "/overview";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Auth pages are public; middleware still runs so we can redirect signed-in users
        if (path === "/login" || path === "/signup") {
          return true;
        }
        // Everything else in the matcher requires a session
        return !!token;
      },
    },
  },
);

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
    "/admin",
    "/admin/:path*",
    "/login",
    "/signup",
  ],
};
