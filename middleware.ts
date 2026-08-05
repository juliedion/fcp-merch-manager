import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, expectedSessionToken } from "@/lib/mavely-auth";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // Let Next internals and static assets through untouched.
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || /\.(png|jpg|jpeg|svg|ico|css|js|webmanifest|csv)$/.test(pathname)) {
    return NextResponse.next();
  }

  const expected = await expectedSessionToken();
  // If APP_PASSWORD is not configured, do not lock the operator out — leave the app open
  // but this should be set before deploying somewhere publicly reachable.
  if (!expected) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie && cookie === expected) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
