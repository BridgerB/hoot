import { json } from "@sveltejs/kit";
import { editMessage } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const { roomId, eventId, text } = await request.json();
	if (!roomId || !eventId || !text?.trim())
		return json({ error: "roomId, eventId, text required" }, { status: 400 });
	try {
		await editMessage(locals.auth, roomId, eventId, text.trim());
		return json({ ok: true });
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};
