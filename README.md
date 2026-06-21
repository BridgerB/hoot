# 🦉 hoot

A small, modern **Matrix client** built with SvelteKit (Svelte 5) as a static SPA. It runs **matrix-js-sdk in the browser** — with the Rust crypto engine for real **end-to-end encryption** — over a Slate-Pro dark theme and a classic three-pane layout.

> **Status: early prototype.** It does real, **end-to-end-encrypted** messaging (Olm/Megolm via the Rust crypto WASM, cross-signing + key backup + recovery key) against a live homeserver, but it's still missing things a mature client has (see the comparison below).

## Develop

```sh
npm install
npm run dev        # vite dev server
npm run check      # svelte-check (type-check)
npm run lint       # biome check .
npm run format     # biome format --write .
npm run build      # production build (adapter-node)
```

Sign in on `/login` with any account on the homeserver (the default is prefilled on the login screen). The whole client runs in the browser — the access token lives in `localStorage`, sync data + E2EE keys in IndexedDB; there is no app server.

## What works today

Login/logout · rooms, spaces (space-as-filter), DMs · live sync · **end-to-end encryption** (encrypted rooms, cross-signing, key backup, recovery key — Settings → Encryption) · **reactions** (+ emoji picker) **, replies, edit, delete** · **threads** · **polls** · **location sharing** · **voice messages** · **stickers** (im.ponies packs) · **widgets** (sandboxed iframe) · **1:1 voice/video calls** · **moderation** (kick/ban) + start-DM from the member list · typing indicators · **read receipts** (seen-by avatars) · image/file upload with inline preview · **full-history server search** · **desktop notifications** (push-rule aware) · **multi-account switcher** (Settings → Accounts) · markdown · load-older history · create room/space (encrypted optional) · edit display name · ⌘K search.

## Feature comparison

How hoot stacks up against the other Matrix clients vendored under `../` for reference. Verified against each project's source + docs, **June 2026**.

Legend: ✅ full · ◐ partial / limited / behind a flag · ❌ none

| Feature | 🦉 hoot | Element Web | Cinny | Nheko | FluffyChat | SchildiChat R. | Tammy |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **E2E encryption** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-signing / verification | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Key backup / recovery | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
| **Spaces** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Threads** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Replies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit messages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete / redact | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read receipts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typing indicators | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1:1 voice / video | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Group calls | ◐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Widgets | ◐ | ✅ | ✅ | ◐ | ❌ | ❌ | ❌ |
| File / media upload | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message search | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ |
| Push notifications | ◐ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
| Multiple accounts | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| SSO / OIDC login | ❌ | ✅ | ✅ | ◐ | ✅ | ❌ | ✅ |
| In-app registration | ✅ | ✅ | ✅ | ✅ | ◐ | ❌ | ✅ |
| Polls | ✅ | ✅ | ❌ | ❌ | ✅ | ◐ | ❌ |
| Location sharing | ✅ | ✅ | ❌ | ❌ | ✅ | ◐ | ◐ |
| Stickers / custom emoji | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Markdown | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderation (ban/kick) | ✅ | ◐ | ✅ | ✅ | ✅ | ✅ | ◐ |
| Voice messages | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

### Project profiles

| | 🦉 hoot | Element Web | Cinny | Nheko | FluffyChat | SchildiChat R. | Tammy |
|---|---|---|---|---|---|---|---|
| Platforms | Web | Web, Desktop | Web, Desktop (Tauri) | Linux/macOS/Win | Android/iOS/Web/Desktop | Linux/Win (macOS build) | Android/iOS/Web/Desktop |
| Stack | SvelteKit / TS | React / TS | React / TS / Vite | C++20 / Qt6 | Dart / Flutter | Kotlin / Compose MP | Kotlin Multiplatform |
| Matrix SDK | matrix-js-sdk | matrix-js-sdk | matrix-js-sdk | mtxclient | matrix-dart-sdk | Matrix Rust SDK | Trixnity |
| License | Unlicense | AGPL/GPL/Commercial | AGPL-3.0 | GPL-3.0+ | AGPL-3.0 | AGPL-3.0 | AGPL-3.0 |
| Status | prototype | Active | Active | Active | Active (alpha) | Active (alpha) | Active |

**Reading the table:** Element Web and Cinny are the most complete web clients (full E2EE, calls, widgets, polls). FluffyChat is the most feature-complete cross-platform option (multi-account, voice messages, location, polls). Nheko is a capable native-desktop client. SchildiChat Revenge and Tammy are newer Kotlin Multiplatform clients on the Rust/Trixnity SDKs. **hoot** is the youngest — a from-scratch SvelteKit SPA on matrix-js-sdk — but it now covers nearly the whole everyday surface: **E2EE** (cross-signing, key backup, recovery key), **threads, polls, location, voice messages, 1:1 calls**, moderation, full-history search, and more.

### hoot's notable gaps

The honest to-do list, roughly in priority order: **interactive device verification** (SAS/emoji — cross-signing + recovery-key unlock work, but no QR/emoji verify flow yet), **true background push** (notifications are foreground-only and push-rule aware — same as Element Web / Cinny on the web — but real OS push needs a sygnal/UnifiedPush gateway), and **SSO/OIDC** login. The recently-added **widgets** (◐, displayed in a sandboxed iframe but no `matrix-widget-api` postMessage channel yet) and **stickers** (◐, render + send from im.ponies packs, but no in-app pack management or custom-emoji-in-messages) are partial.

**Group calls (◐)** are *implemented* via the SDK's full-mesh `GroupCall` (no SFU — peer-to-peer over the homeserver's TURN), and the create/join/membership signalling is verified against the live server. But it's the path upstream deprecated (Element/Cinny moved to Element Call + a LiveKit SFU), it only suits a handful of participants, and the actual media connection hasn't been verified end-to-end yet. For something scalable, the real answer is hosting a LiveKit SFU and embedding Element Call.
