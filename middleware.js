import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/core/session";

const PUBLIC = ["/login", "/setup"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const uid = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
