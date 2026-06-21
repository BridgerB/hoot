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
import { decodeRecoveryKey } from "matrix-js-sdk/lib/crypto-api/recovery-key";
import { upsertAccount } from "./accounts.svelte";
import { callController } from "./call.svelte";
import { resolveNames } from "./matrix-map";

// The decoded 4S (secret storage) key, held in memory once the user sets up or
// unlocks encryption. The getSecretStorageKey callback (wired at createClient)
// hands it back to the SDK whenever it needs to read/write cross-signing keys.
let secretStorageKey: Uint8Array<ArrayBuffer> | undefined;

export type Session = {
	baseUrl: string;
	accessToken: string;
	userId: string;
	deviceId: string;
};

// Optional ?profile=NAME isolates the session (separate localStorage key +
// IndexedDB stores) so multiple accounts can run in the same browser — e.g.
// /?profile=bob in another tab. Empty = the default profile.
const PROFILE =
	typeof location !== "undefined"
		? (new URLSearchParams(location.search).get("profile") ?? "")
		: "";
const SFX = PROFILE ? `-${PROFILE}` : "";
const KEY = `hoot.session${PROFILE ? `.${PROFILE}` : ""}`;
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
		dbName: `hoot-sync${SFX}`,
	});
	const cryptoStore = new IndexedDBCryptoStore(
		window.indexedDB,
		`hoot-crypto${SFX}`,
	);

	client = createClient({
		baseUrl: session.baseUrl,
		accessToken: session.accessToken,
		userId: session.userId,
		deviceId: session.deviceId,
		store,
		cryptoStore,
		timelineSupport: true,
		cryptoCallbacks: {
			getSecretStorageKey: async ({ keys }) => {
				if (!secretStorageKey) return null;
				const keyId = Object.keys(keys)[0];
				return [keyId, secretStorageKey];
			},
		},
	});
	// startup() must run after the store is assigned to the client.
	await store.startup();

	if (import.meta.env.DEV) {
		const w = window as unknown as Record<string, unknown>;
		w.__mxClient = client;
		w.__hootCrypto = { setupEncryption, unlockEncryption, encryptionStatus };
	}

	// E2EE: the Rust crypto engine (matrix-sdk-crypto-wasm) persists to its
	// own IndexedDB. Encrypted rooms then decrypt automatically.
	try {
		await client.initRustCrypto({
			useIndexedDB: true,
			// isolate non-default profiles' rust-crypto store (the default keeps
			// its existing DB so alice's cross-signing setup persists)
			...(PROFILE ? { cryptoDatabasePrefix: `hoot-rust-${PROFILE}` } : {}),
		});
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
	client.on(
		RoomEvent.Timeline,
		(event, room, toStartOfTimeline, _removed, data) => {
			mx.rev++;
			// desktop notification for live incoming messages while unfocused.
			// Like Element/Cinny on web, this is foreground-only (no sygnal/push
			// gateway), but it respects the account's push rules.
			if (toStartOfTimeline || !data?.liveEvent) return;
			if (
				event.getType() !== "m.room.message" ||
				event.getSender() === mx.userId
			)
				return;
			if (
				typeof Notification === "undefined" ||
				Notification.permission !== "granted" ||
				!document.hidden
			)
				return;
			// honour the user's push rules (DMs, mentions, keywords, room overrides)
			if (!client?.getPushActionsForEvent(event)?.notify) return;
			const sender =
				room?.getMember(event.getSender() ?? "")?.name ??
				event.getSender() ??
				"";
			const title = room?.name ? `${sender} · ${room.name}` : sender;
			const n = new Notification(title, {
				body: String(event.getContent().body ?? "New message").slice(0, 140),
				tag: room?.roomId,
			});
			n.onclick = () => {
				window.focus();
				n.close();
			};
		},
	);
	client.on(RoomEvent.Receipt, () => mx.rev++);
	client.on(RoomMemberEvent.Typing, () => mx.rev++);
	client.on(MatrixEventEvent.Decrypted, () => mx.rev++);
	client.on(ClientEvent.Room, () => {
		mx.rev++;
		void refreshNames();
	});

	await client.startClient({ initialSyncLimit: 30 });
	callController.init(client);
	upsertAccount({
		profile: PROFILE,
		userId: session.userId,
		homeserver: session.baseUrl,
		displayName: client.getUser(session.userId)?.displayName ?? undefined,
	});
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

// --- E2EE setup / unlock (cross-signing + key backup + secret storage) ---

// First-time setup: generate a recovery key, create 4S + key backup, and
// publish cross-signing keys (UIA password auth). Returns the recovery key to
// show the user once.
export async function setupEncryption(password: string): Promise<string> {
	const crypto = client?.getCrypto();
	if (!client || !crypto) throw new Error("crypto unavailable");
	const rk = await crypto.createRecoveryKeyFromPassphrase();
	secretStorageKey = rk.privateKey as Uint8Array<ArrayBuffer>;
	await crypto.bootstrapSecretStorage({
		createSecretStorageKey: async () => rk,
		setupNewSecretStorage: true,
		setupNewKeyBackup: true,
	});
	await crypto.bootstrapCrossSigning({
		authUploadDeviceSigningKeys: async (makeRequest) => {
			await makeRequest({
				type: "m.login.password",
				identifier: { type: "m.id.user", user: client?.getUserId() ?? "" },
				password,
			});
		},
	});
	mx.rev++;
	return rk.encodedPrivateKey ?? "";
}

// Existing account, new device: unlock 4S with the recovery key and pull
// cross-signing + key backup onto this device so it becomes verified.
export async function unlockEncryption(recoveryKey: string): Promise<void> {
	const crypto = client?.getCrypto();
	if (!client || !crypto) throw new Error("crypto unavailable");
	secretStorageKey = decodeRecoveryKey(recoveryKey.replace(/\s+/g, ""));
	await crypto.bootstrapCrossSigning({
		authUploadDeviceSigningKeys: async () => {},
	});
	mx.rev++;
}

export async function encryptionStatus(): Promise<{
	crypto: boolean;
	crossSigning: boolean;
	secretStorage: boolean;
	backup: string | null;
}> {
	const crypto = client?.getCrypto();
	if (!crypto)
		return {
			crypto: false,
			crossSigning: false,
			secretStorage: false,
			backup: null,
		};
	return {
		crypto: true,
		crossSigning: await crypto.isCrossSigningReady(),
		secretStorage: await crypto.isSecretStorageReady(),
		backup: await crypto.getActiveSessionBackupVersion(),
	};
}

// --- desktop notifications ---
export function notificationPermission():
	| "default"
	| "granted"
	| "denied"
	| "unsupported" {
	if (typeof Notification === "undefined") return "unsupported";
	return Notification.permission;
}
export async function enableNotifications(): Promise<
	NotificationPermission | "unsupported"
> {
	if (typeof Notification === "undefined") return "unsupported";
	return Notification.requestPermission();
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
