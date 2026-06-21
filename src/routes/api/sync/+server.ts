import { json } from "@sveltejs/kit";
import { syncSince } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const since = url.searchParams.get("since") ?? "";
	try {
		return json(await syncSince(locals.auth, since));
	} catch (e) {
		return json(
			{ error: String(e), nextBatch: since, rooms: {}, meta: {} },
			{ status: 502 },
		);
	}
};
