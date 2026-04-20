import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase";

export async function proxy(request: NextRequest) {
  const { response, session } = await updateSupabaseSession(request);
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (!isDashboardRoute || session) {
    return response;
  }

  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  const redirectResponse = NextResponse.redirect(loginUrl);

  response.cookies
    .getAll()
    .forEach((cookie) => redirectResponse.cookies.set(cookie));

  return redirectResponse;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
