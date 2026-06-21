import type { Handle } from "@sveltejs/kit";

// Read the httpOnly session cookies into locals so routes can talk to the
// homeserver on the user's behalf. The token never reaches the browser.
export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get("hoot_token");
	const userId = event.cookies.get("hoot_user");
	event.locals.auth = token && userId ? { token, userId } : null;
	return resolve(event);
};
