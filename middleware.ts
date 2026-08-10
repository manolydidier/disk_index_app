// middleware.ts

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized: ({ token }) => {
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    "/((?!login|forgot-password|reset-password|api|_next/static|_next/image|favicon.ico|icon|apple-icon).*)",
  ],
};