import { json } from "@sveltejs/kit";
import { login, register } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

const COOKIE = {
	path: "/",
	httpOnly: true,
	sameSite: "lax" as const,
	maxAge: 60 * 60 * 24 * 30,
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { user, pass, mode } = await request.json();
	if (!user?.trim() || !pass)
		return json({ error: "username and password required" }, { status: 400 });
	try {
		const auth =
			mode === "register"
				? await register(user.trim(), pass)
				: await login(user.trim(), pass);
		cookies.set("hoot_token", auth.token, COOKIE);
		cookies.set("hoot_user", auth.userId, COOKIE);
		return json({ ok: true, userId: auth.userId });
	} catch (e) {
		return json(
			{ error: String(e instanceof Error ? e.message : e) },
			{ status: 401 },
		);
	}
};
