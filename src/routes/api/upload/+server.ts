import { json } from "@sveltejs/kit";
import { uploadMedia } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.auth) return json({ error: "unauthorized" }, { status: 401 });
	const name = url.searchParams.get("name") ?? "file";
	const contentType =
		request.headers.get("content-type") ?? "application/octet-stream";
	try {
		const bytes = await request.arrayBuffer();
		if (!bytes.byteLength)
			return json({ error: "empty body" }, { status: 400 });
		const { mxc } = await uploadMedia(locals.auth, name, contentType, bytes);
		return json({ mxc, name, contentType, size: bytes.byteLength });
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};
