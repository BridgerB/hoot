/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// Push-only service worker. The browser's push service wakes the `push` event
// (delivered by our serverless gateway via web-push); we show a notification
// and route clicks back to the right room. No offline caching — the app is a
// live Matrix client, so stale precached assets would do more harm than good.
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (e) => e.waitUntil(sw.skipWaiting()));
sw.addEventListener("activate", (e) => e.waitUntil(sw.clients.claim()));

sw.addEventListener("push", (event) => {
	const data = event.data?.json();
	const n = data?.notification;
	if (!n) return;
	event.waitUntil(
		sw.registration.showNotification(n.title ?? "hoot", {
			body: n.body ?? "New message",
			icon: n.icon ?? "/pwa-192x192.png",
			badge: "/pwa-192x192.png",
			tag: n.tag ?? n.room_id,
			data: { roomId: n.room_id },
		}),
	);
});

sw.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const roomId = (event.notification.data as { roomId?: string } | undefined)
		?.roomId;
	event.waitUntil(
		(async () => {
			const all = await sw.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			const existing = all.find((c) => "focus" in c) as
				| WindowClient
				| undefined;
			if (existing) {
				await existing.focus();
				if (roomId) existing.postMessage({ type: "hoot:navigate", roomId });
			} else {
				await sw.clients.openWindow(
					roomId ? `/?room=${encodeURIComponent(roomId)}` : "/",
				);
			}
		})(),
	);
});
