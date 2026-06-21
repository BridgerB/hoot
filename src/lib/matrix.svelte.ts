// Browser-side Matrix client (matrix-js-sdk). Runs entirely in the browser:
// the access token + sync data + (later) E2EE keys live in localStorage /
// IndexedDB. Exposes a runes store; UI re-derives off `mx.rev`.
import {
	ClientEvent,
	createClient,
	IndexedDBCryptoStore,
	IndexedDBStore,
	type MatrixClient,
	MatrixEventEvent,
	RoomEvent,
	RoomMemberEvent,
	SyncState,
} from "matrix-js-sdk";
import { resolveNames } from "./matrix-map";

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
	crypto: boolean; // Rust crypto (E2EE) initialised
	rev: number; // bumped on any sync/timeline change so the UI re-derives
}>({ status: "idle", userId: "", crypto: false, rev: 0 });

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
	const cryptoStore = new IndexedDBCryptoStore(window.indexedDB, "hoot-crypto");

	client = createClient({
		baseUrl: session.baseUrl,
		accessToken: session.accessToken,
		userId: session.userId,
		deviceId: session.deviceId,
		store,
		cryptoStore,
		timelineSupport: true,
	});
	// startup() must run after the store is assigned to the client.
	await store.startup();

	if (import.meta.env.DEV) {
		(window as unknown as Record<string, unknown>).__mxClient = client;
	}

	// E2EE: the Rust crypto engine (matrix-sdk-crypto-wasm) persists to its
	// own IndexedDB. Encrypted rooms then decrypt automatically.
	try {
		await client.initRustCrypto({ useIndexedDB: true });
		mx.crypto = true;
	} catch (e) {
		mx.crypto = false;
		console.error("initRustCrypto failed", e);
	}

	client.on(ClientEvent.Sync, (state: SyncState) => {
		if (state === SyncState.Prepared || state === SyncState.Syncing) {
			mx.status = "ready";
			mx.rev++;
			void refreshNames();
		} else if (state === SyncState.Error) {
			mx.error = "sync error";
		}
	});
	client.on(RoomEvent.Timeline, () => mx.rev++);
	client.on(RoomEvent.Receipt, () => mx.rev++);
	client.on(RoomMemberEvent.Typing, () => mx.rev++);
	client.on(MatrixEventEvent.Decrypted, () => mx.rev++);
	client.on(ClientEvent.Room, () => {
		mx.rev++;
		void refreshNames();
	});

	await client.startClient({ initialSyncLimit: 30 });
}

// strix omits displaynames from member events; fetch profiles so DMs and
// senders show real names. Bumps rev only when something new resolves.
async function refreshNames(): Promise<void> {
	if (!client) return;
	const ids = client
		.getRooms()
		.flatMap((r) => r.getJoinedMembers().map((m) => m.userId));
	if (await resolveNames(client, ids)) mx.rev++;
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
