// hoot push gateway — a stateless Matrix push gateway on Firebase Functions.
//
// The homeserver POSTs /_matrix/push/v1/notify here when a push rule matches.
// Each device carries the web-push subscription in its `data` (we stashed it
// there via client.setPusher). We VAPID-sign an encrypted web-push to the
// browser's push service, which wakes the service worker's `push` event.
//
// Stateless: no database. The subscription travels in the notify payload, so
// this only runs when there's something to deliver (serverless, wake-on-POST).
const { onRequest } = require("firebase-functions/v2/https");
const webpush = require("web-push");

webpush.setVapidDetails(
	process.env.VAPID_SUBJECT || "mailto:admin@hoot.local",
	process.env.VAPID_PUBLIC_KEY,
	process.env.VAPID_PRIVATE_KEY,
);

// Matrix push gateway: respond with the pushkeys to drop (expired/invalid).
exports.notify = onRequest(
	{ cors: false, maxInstances: 5 },
	async (req, res) => {
		if (req.method !== "POST") return res.status(405).end();
		const n = req.body && req.body.notification;
		if (!n) return res.status(400).json({ rejected: [] });

		const title = n.room_name || n.sender_display_name || "hoot";
		// For E2EE rooms the homeserver has no plaintext body, so it's omitted.
		const body =
			(n.content && n.content.body) ||
			(n.event_id ? "New message" : "New activity");
		const rejected = [];

		await Promise.all(
			(n.devices || []).map(async (device) => {
				const d = device.data || {};
				if (!d.endpoint || !d.p256dh || !d.auth) {
					rejected.push(device.pushkey);
					return;
				}
				const payload = JSON.stringify({
					notification: {
						title,
						body,
						icon: "/pwa-192x192.png",
						room_id: n.room_id,
						tag: n.room_id,
					},
				});
				try {
					await webpush.sendNotification(
						{ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
						payload,
					);
				} catch (e) {
					// 404/410 = subscription gone -> tell the homeserver to drop the pusher
					if (e.statusCode === 404 || e.statusCode === 410)
						rejected.push(device.pushkey);
					else console.error("web-push error", e.statusCode, e.body);
				}
			}),
		);

		res.json({ rejected });
	},
);
