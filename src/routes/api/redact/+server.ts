import { json } from "@sveltejs/kit";
import { redact } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const { roomId, eventId } = await request.json();
	if (!roomId || !eventId)
		return json({ error: "roomId, eventId required" }, { status: 400 });
	try {
		await redact(locals.auth, roomId, eventId);
		return json({ ok: true });
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};
