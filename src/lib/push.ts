// Web push wiring. The browser subscribes (PushManager), then we register that
// subscription as a Matrix *http pusher* — stashing the web-push keys in the
// pusher `data`, which the homeserver echoes back to our serverless gateway in
// every /_matrix/push/v1/notify. The gateway (see push-gateway/) does the
// VAPID-signed web-push send. No always-on server, no subscription DB.
import { getClient } from "./matrix.svelte";

// Public VAPID key — safe to embed. The matching private key lives ONLY in the
// gateway's environment.
const VAPID_PUBLIC_KEY =
	"BCEWqMGDL9kQqOyJr7FB7YkQmhyOrZNoDb7bb6omKLu9zS4Nce8q8YKOuxbguf0nRlxV7vbPKA83banWyskEITI";

// The deployed gateway's notify endpoint. Set this after deploying push-gateway/.
export const PUSH_GATEWAY_URL =
	"https://CHANGE-ME.example.com/_matrix/push/v1/notify";
const APP_ID = "im.hoot.web";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(b64);
	const arr = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
	return arr;
}

export function webPushSupported(): boolean {
	return (
		typeof navigator !== "undefined" &&
		"serviceWorker" in navigator &&
		typeof window !== "undefined" &&
		"PushManager" in window &&
		typeof Notification !== "undefined"
	);
}

export async function isWebPushEnabled(): Promise<boolean> {
	if (!webPushSupported()) return false;
	const reg = await navigator.serviceWorker.getRegistration();
	return !!(await reg?.pushManager.getSubscription());
}

export async function enableWebPush(): Promise<void> {
	const client = getClient();
	if (!client || !webPushSupported()) throw new Error("push unsupported");
	if (Notification.permission !== "granted") {
		if ((await Notification.requestPermission()) !== "granted")
			throw new Error("notification permission denied");
	}
	const reg = await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
		}));
	const keys = sub.toJSON().keys ?? {};
	// biome-ignore lint/suspicious/noExplicitAny: pusher data carries web-push keys (SDK types only url/format/brand)
	await client.setPusher({
		kind: "http",
		app_id: APP_ID,
		pushkey: sub.endpoint,
		app_display_name: "hoot (web)",
		device_display_name: navigator.userAgent.slice(0, 80),
		lang: navigator.language || "en",
		append: false,
		data: {
			url: PUSH_GATEWAY_URL,
			endpoint: sub.endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
		},
	} as any);
}

export async function disableWebPush(): Promise<void> {
	const client = getClient();
	const reg = await navigator.serviceWorker.getRegistration();
	const sub = await reg?.pushManager.getSubscription();
	if (!sub) return;
	try {
		await client?.removePusher(sub.endpoint, APP_ID);
	} catch {
		/* pusher may already be gone */
	}
	await sub.unsubscribe();
}
