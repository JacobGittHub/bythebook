import { NextResponse, type NextRequest } from "next/server";
import { requiresAccount } from "@/lib/auth/access";
import { updateSupabaseSession } from "@/lib/supabase";

// Runs on every dashboard request. It refreshes the Supabase session, which is what signs a
// returning user back in, and lets guests through to every page that doesn't need an
// account.
export async function proxy(request: NextRequest) {
  const { response, session } = await updateSupabaseSession(request);

  if (session || !requiresAccount(request.nextUrl.pathname)) {
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
