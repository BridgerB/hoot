import { json } from "@sveltejs/kit";
import { setTyping } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const { roomId, typing } = await request.json();
	if (!roomId) return json({ error: "roomId required" }, { status: 400 });
	await setTyping(locals.auth, roomId, !!typing);
	return json({ ok: true });
};
