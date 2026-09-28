import { hasAdminSession } from "../src/admin-session.js";

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !(await hasAdminSession(context.request, context.env.ADMIN_KEY))) {
    return Response.redirect(new URL("/admin-login.html", context.request.url), 302);
  }
  return context.next();
}
