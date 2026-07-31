// middleware.ts

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/",
    
  },

  callbacks: {
    authorized: ({ token }) => {
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    "/disks/:path*",
    "/settings/:path*",
    
  ],
};