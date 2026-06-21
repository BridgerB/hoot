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

Login/logout · rooms, spaces (space-as-filter), DMs · live sync · **end-to-end encryption** (encrypted rooms, cross-signing, key backup, recovery key — Settings → Encryption) · **reactions, replies, edit, delete** · typing indicators · read receipts · image/file upload with inline preview · **full-history server search** · **desktop notifications** · day separators · markdown · load-older history · create room/space (encrypted optional) · edit display name · ⌘K search.

## Feature comparison

How hoot stacks up against the other Matrix clients vendored under `../` for reference. Verified against each project's source + docs, **June 2026**.

Legend: ✅ full · ◐ partial / limited / behind a flag · ❌ none

| Feature | 🦉 hoot | Element Web | Cinny | Nheko | FluffyChat | SchildiChat R. | Tammy |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **E2E encryption** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-signing / verification | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Key backup / recovery | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
| **Spaces** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Threads** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Replies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit messages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete / redact | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read receipts | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typing indicators | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1:1 voice / video | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Group calls | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Widgets | ❌ | ✅ | ✅ | ◐ | ❌ | ❌ | ❌ |
| File / media upload | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message search | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ |
| Push notifications | ◐ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
| Multiple accounts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| SSO / OIDC login | ❌ | ✅ | ✅ | ◐ | ✅ | ❌ | ✅ |
| In-app registration | ✅ | ✅ | ✅ | ✅ | ◐ | ❌ | ✅ |
| Polls | ❌ | ✅ | ❌ | ❌ | ✅ | ◐ | ❌ |
| Location sharing | ❌ | ✅ | ❌ | ❌ | ✅ | ◐ | ◐ |
| Stickers / custom emoji | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Markdown | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderation (ban/kick) | ❌ | ◐ | ✅ | ✅ | ✅ | ✅ | ◐ |
| Voice messages | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

### Project profiles

| | 🦉 hoot | Element Web | Cinny | Nheko | FluffyChat | SchildiChat R. | Tammy |
|---|---|---|---|---|---|---|---|
| Platforms | Web | Web, Desktop | Web, Desktop (Tauri) | Linux/macOS/Win | Android/iOS/Web/Desktop | Linux/Win (macOS build) | Android/iOS/Web/Desktop |
| Stack | SvelteKit / TS | React / TS | React / TS / Vite | C++20 / Qt6 | Dart / Flutter | Kotlin / Compose MP | Kotlin Multiplatform |
| Matrix SDK | matrix-js-sdk | matrix-js-sdk | matrix-js-sdk | mtxclient | matrix-dart-sdk | Matrix Rust SDK | Trixnity |
| License | Unlicense | AGPL/GPL/Commercial | AGPL-3.0 | GPL-3.0+ | AGPL-3.0 | AGPL-3.0 | AGPL-3.0 |
| Status | prototype | Active | Active | Active | Active (alpha) | Active (alpha) | Active |

**Reading the table:** Element Web and Cinny are the most complete web clients (full E2EE, calls, widgets, polls). FluffyChat is the most feature-complete cross-platform option (multi-account, voice messages, location, polls). Nheko is a capable native-desktop client. SchildiChat Revenge and Tammy are newer Kotlin Multiplatform clients on the Rust/Trixnity SDKs. **hoot** is the youngest — a from-scratch SvelteKit SPA on matrix-js-sdk — but it now covers the everyday surface (reactions/replies/edits/typing/media/spaces) **plus end-to-end encryption** (cross-signing, key backup, recovery key) and full-history server search.

### hoot's notable gaps

The honest to-do list, roughly in priority order: **interactive device verification** (SAS/emoji — cross-signing + recovery-key unlock work, but there's no QR/emoji verify flow yet), threads, voice/video calls (1:1 needs coturn on the server; group needs an SFU), true Matrix push (currently desktop `Notification`s only, no sygnal/UnifiedPush), multi-account, SSO/OIDC, and the smaller polish (polls, location, voice messages, custom emoji, moderation tools).
