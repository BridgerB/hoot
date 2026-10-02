// Multi-account registry. Each account is a `?profile=NAME` (separate
// localStorage + IndexedDB sync/crypto stores — see matrix.svelte.ts). This
// shared list (NOT namespaced by profile) tracks which accounts exist so the
// switcher can render without constructing every client. Model A: one active
// at a time, switching = full reload to the chosen profile.
export type AccountEntry = {
	profile: string; // "" = default
	userId: string;
	homeserver: string;
	displayName?: string;
};

const KEY = "hoot.accounts";
function load(): AccountEntry[] {
	if (typeof localStorage === "undefined") return [];
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "[]");
	} catch {
		return [];
	}
}

export const accounts = $state<{ list: AccountEntry[] }>({ list: load() });
const persist = () => localStorage.setItem(KEY, JSON.stringify(accounts.list));

export function activeProfile(): string {
	return typeof location !== "undefined"
		? (new URLSearchParams(location.search).get("profile") ?? "")
		: "";
}

export function upsertAccount(e: AccountEntry) {
	const i = accounts.list.findIndex((a) => a.profile === e.profile);
	if (i >= 0) accounts.list[i] = { ...accounts.list[i], ...e };
	else accounts.list.push(e);
	persist();
}

export function removeAccount(profile: string) {
	accounts.list = accounts.list.filter((a) => a.profile !== profile);
	persist();
}

export function switchTo(profile: string) {
	if (profile === activeProfile()) return;
	const url = new URL(location.href);
	url.pathname = "/";
	if (profile) url.searchParams.set("profile", profile);
	else url.searchParams.delete("profile");
	location.assign(url.toString()); // full reload: clean client + crypto teardown
}

export function addAccount() {
	switchTo(`acct${Date.now().toString(36)}`); // fresh profile -> login screen
}
