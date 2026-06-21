import { redirect } from "@sveltejs/kit";
import { BASE } from "$lib/server/matrix";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.auth) redirect(303, "/");
	return { server: BASE };
};
