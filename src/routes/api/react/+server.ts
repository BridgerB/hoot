import { json } from "@sveltejs/kit";
import { react } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const { roomId, eventId, key } = await request.json();
	if (!roomId || !eventId || !key)
		return json({ error: "roomId, eventId, key required" }, { status: 400 });
	try {
		return json(await react(locals.auth, roomId, eventId, key));
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};
