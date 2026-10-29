import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Taken: de Supabase-sessie verversen en elke route behalve /login en /mfa
 * afschermen. Autorisatie zit óók in requireUser() in elke pagina en actie.
 */
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_INTERNAL_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() laat Supabase het token verifiëren en verversen.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/zoeken";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const onMfa = pathname === "/mfa" || pathname.startsWith("/mfa/");
  if (assurance?.currentLevel === "aal1") {
    const target = assurance.nextLevel === "aal2" ? "/mfa" : "/mfa/instellen";
    if (pathname !== target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      return NextResponse.redirect(url);
    }
  } else if (onMfa && pathname !== "/mfa/instellen") {
    const url = request.nextUrl.clone();
    url.pathname = "/zoeken";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/).*)"],
};
