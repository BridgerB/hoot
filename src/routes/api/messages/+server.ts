import { json } from "@sveltejs/kit";
import { paginate } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const roomId = url.searchParams.get("roomId");
	const from = url.searchParams.get("from") ?? "";
	if (!roomId) return json({ error: "roomId required" }, { status: 400 });
	try {
		return json(await paginate(locals.auth, roomId, from));
	} catch (e) {
		return json({ error: String(e), messages: [], end: from }, { status: 502 });
	}
};
