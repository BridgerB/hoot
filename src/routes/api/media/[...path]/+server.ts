import { mediaDownload } from "$lib/server/matrix";
import type { RequestHandler } from "./$types";

// Streams homeserver media (mxc) through our origin (no CORS; auth stays server-side).
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.auth) return new Response("unauthorized", { status: 401 });
	const upstream = await mediaDownload(locals.auth, params.path);
	if (!upstream.ok || !upstream.body) {
		return new Response("media error", { status: upstream.status || 502 });
	}
	return new Response(upstream.body, {
		status: 200,
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/octet-stream",
			"cache-control": "private, max-age=86400",
		},
	});
};
