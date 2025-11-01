import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // This callback is called after the user is authenticated
    // You can add custom authorization logic here if needed
    // For now, simply allow access if authenticated
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // Allow if token exists (user is authenticated)
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/users/:path*',
    '/dashboard/products/:path*',
    '/dashboard/logs/:path*',
    '/dashboard/trigger-price-update/:path*',
    '/api/admin/:path*',
  ],
};