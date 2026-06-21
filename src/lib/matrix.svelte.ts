// Browser-side Matrix client (matrix-js-sdk). Runs entirely in the browser:
// the access token + sync data + (later) E2EE keys live in localStorage /
// IndexedDB. Exposes a runes store; UI re-derives off `mx.rev`.
import {
	ClientEvent,
	createClient,
	IndexedDBStore,
	type MatrixClient,
	RoomEvent,
	SyncState,
} from "matrix-js-sdk";

export type Session = {
	baseUrl: string;
	accessToken: string;
	userId: string;
	deviceId: string;
};

const KEY = "hoot.session";
const loadSession = (): Session | null => {
	try {
		const v = localStorage.getItem(KEY);
		return v ? (JSON.parse(v) as Session) : null;
	} catch {
		return null;
	}
};
const saveSession = (s: Session) =>
	localStorage.setItem(KEY, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(KEY);

let client: MatrixClient | undefined;
export const getClient = () => client;

export const mx = $state<{
	status: "idle" | "connecting" | "syncing" | "ready" | "error";
	error?: string;
	userId: string;
	rev: number; // bumped on any sync/timeline change so the UI re-derives
}>({ status: "idle", userId: "", rev: 0 });

export const hasSession = () => !!loadSession();

export async function login(
	baseUrl: string,
	user: string,
	password: string,
): Promise<void> {
	mx.status = "connecting";
	mx.error = undefined;
	const tmp = createClient({ baseUrl });
	const res = await tmp.loginRequest({
		type: "m.login.password",
		identifier: { type: "m.id.user", user },
		password,
	});
	const session: Session = {
		baseUrl,
		accessToken: res.access_token,
		userId: res.user_id,
		deviceId: res.device_id,
	};
	saveSession(session);
	await start(session);
}

export async function restore(): Promise<boolean> {
	const s = loadSession();
	if (!s) return false;
	await start(s);
	return true;
}

async function start(session: Session): Promise<void> {
	mx.status = "syncing";
	mx.userId = session.userId;

	const store = new IndexedDBStore({
		indexedDB: window.indexedDB,
		localStorage: window.localStorage,
		dbName: "hoot-sync",
	});
	await store.startup();

	client = createClient({
		baseUrl: session.baseUrl,
		accessToken: session.accessToken,
		userId: session.userId,
		deviceId: session.deviceId,
		store,
		timelineSupport: true,
	});

	client.on(ClientEvent.Sync, (state: SyncState) => {
		if (state === SyncState.Prepared || state === SyncState.Syncing) {
			mx.status = "ready";
			mx.rev++;
		} else if (state === SyncState.Error) {
			mx.error = "sync error";
		}
	});
	client.on(RoomEvent.Timeline, () => mx.rev++);
	client.on(RoomEvent.Receipt, () => mx.rev++);
	client.on(ClientEvent.Room, () => mx.rev++);

	await client.startClient({ initialSyncLimit: 30 });
}

export async function logout(): Promise<void> {
	try {
		await client?.logout(true);
	} catch {
		/* ignore */
	}
	client?.stopClient();
	client = undefined;
	clearSession();
	mx.status = "idle";
	mx.userId = "";
	mx.rev++;
}
