import { json } from "@sveltejs/kit";
import { sendContent, sendMessage } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const { roomId, text, content } = await request.json();
	if (!roomId) return json({ error: "roomId required" }, { status: 400 });
	try {
		const message = content
			? await sendContent(locals.auth, roomId, content)
			: text?.trim()
				? await sendMessage(locals.auth, roomId, text.trim())
				: null;
		if (!message)
			return json({ error: "text or content required" }, { status: 400 });
		return json({ message });
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};
