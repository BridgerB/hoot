# hoot push gateway

A **stateless** [Matrix push gateway](https://spec.matrix.org/latest/push-gateway-api/) on Firebase Functions. The homeserver POSTs `/_matrix/push/v1/notify` here when a push rule matches; we turn that into a VAPID-signed [web-push](https://datatracker.ietf.org/doc/html/rfc8291) to the browser, which wakes the service worker.

It's serverless on purpose: nothing runs until the homeserver POSTs, and there's **no subscription database** — the browser's push subscription rides along inside the pusher `data` (set in the client via `client.setPusher`, echoed back by the homeserver in every notify), so the function reads the keys straight out of the request.

## One-time setup

1. **VAPID keys** — already generated for hoot. The public key is embedded in the client (`src/lib/push.ts`); set the private key here. To rotate, `npx web-push generate-vapid-keys` and update both places.

2. **Deploy** (uses *your own* Firebase project — not shared with anything else):

   ```sh
   cd push-gateway
   npm install
   firebase use <your-project-id>
   firebase functions:secrets:set VAPID_PRIVATE_KEY   # paste the private key
   firebase deploy --only functions:notify
   ```

   Set the public key + subject as env (non-secret) in `firebase.json` runtime config or as plain env:
   `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`).

3. **Point the client at it** — copy the deployed function URL (e.g.
   `https://us-central1-<project>.cloudfunctions.net/notify`) into `PUSH_GATEWAY_URL` in `src/lib/push.ts`.

That's it. Enable push in hoot (Settings → Background push); the homeserver will start POSTing here on matching events.

## Env

| var | where | notes |
|---|---|---|
| `VAPID_PRIVATE_KEY` | secret | the private half of the keypair; never in the client |
| `VAPID_PUBLIC_KEY` | env | must match `VAPID_PUBLIC_KEY` in `src/lib/push.ts` |
| `VAPID_SUBJECT` | env | `mailto:` or `https:` contact, per VAPID spec |

## Protocol notes

- Responds `{ "rejected": [pushkeys] }`; expired subscriptions (web-push 404/410) are reported so the homeserver drops the pusher.
- For unencrypted rooms the notify carries `content.body` → rich notification. For E2EE rooms the homeserver has no plaintext, so it falls back to "New message"; the client shows the real text once opened.
