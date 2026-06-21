# 🦉 hoot

A small, modern **Matrix client** built with SvelteKit (Svelte 5). It talks the Matrix Client-Server API from the SvelteKit server (token in an httpOnly cookie, no CORS), with a Slate-Pro dark theme and a classic three-pane layout.

> **Status: early prototype.** It does real messaging against a live homeserver, but it is **not encrypted** and is missing many things a mature client has (see the comparison below). Don't use it for anything sensitive.

## Develop

```sh
npm install
npm run dev        # vite dev server
npm run check      # svelte-check (type-check)
npm run lint       # biome check .
npm run format     # biome format --write .
npm run build      # production build (adapter-node)
```

The homeserver is configured in `src/lib/server/matrix.ts`. Sign in on `/login` with any account on that server.

## What works today

Login/logout (cookie sessions) · rooms, spaces (space-as-filter), DMs · send/receive live (long-poll sync) · **reactions, replies, edit, delete** · typing indicators · read receipts (sent) · image/file upload with inline preview · in-room search · day separators · markdown · load-older history · create room/space · edit display name · ⌘K search.

## Feature comparison

How hoot stacks up against the other Matrix clients vendored under `../` for reference. Verified against each project's source + docs, **June 2026**.

Legend: ✅ full · ◐ partial / limited / behind a flag · ❌ none

| Feature | 🦉 hoot | Element Web | Cinny | Nheko | FluffyChat | SchildiChat R. | Tammy |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **E2E encryption** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-signing / verification | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Key backup / recovery | ❌ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
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
| Message search | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ |
| Push notifications | ❌ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
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
| Matrix SDK | none (raw C-S API) | matrix-js-sdk | matrix-js-sdk | mtxclient | matrix-dart-sdk | Matrix Rust SDK | Trixnity |
| License | Unlicense | AGPL/GPL/Commercial | AGPL-3.0 | GPL-3.0+ | AGPL-3.0 | AGPL-3.0 | AGPL-3.0 |
| Status | prototype | Active | Active | Active | Active (alpha) | Active (alpha) | Active |

**Reading the table:** Element Web and Cinny are the most complete web clients (full E2EE, calls, widgets, polls). FluffyChat is the most feature-complete cross-platform option (multi-account, voice messages, location, polls). Nheko is a capable native-desktop client. SchildiChat Revenge and Tammy are newer Kotlin Multiplatform clients on the Rust/Trixnity SDKs. **hoot** is the odd one out — a from-scratch SvelteKit prototype with no SDK and **no encryption yet** — but it already covers the everyday messaging surface (reactions/replies/edits/typing/media/spaces).

### hoot's notable gaps

The honest to-do list, roughly in priority order: **end-to-end encryption** (the big one — needs Olm/Megolm or a Rust-SDK binding), threads, voice/video calls, push notifications, message-search over full history (vs. loaded-only), multi-account, SSO/OIDC, and the smaller polish (polls, location, voice messages, custom emoji, moderation tools).
