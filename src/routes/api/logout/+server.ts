import { json } from "@sveltejs/kit";
import { logout } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, locals }) => {
	if (locals.auth) await logout(locals.auth.token);
	cookies.delete("hoot_token", { path: "/" });
	cookies.delete("hoot_user", { path: "/" });
	return json({ ok: true });
};
