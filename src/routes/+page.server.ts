import { redirect } from "@sveltejs/kit";
import { loadClient } from "$lib/server/matrix";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.auth) redirect(303, "/login");
	return await loadClient(locals.auth);
};
