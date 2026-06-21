import { json } from "@sveltejs/kit";
import { createRoom } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const { name } = await request.json();
	if (!name?.trim()) return json({ error: "name required" }, { status: 400 });
	try {
		return json({ room: await createRoom(locals.auth, name.trim()) });
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};
