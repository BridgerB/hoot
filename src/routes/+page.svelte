<script lang="ts">
import { onMount, untrack } from "svelte";
import ChatView from "$lib/client/ChatView.svelte";
import type { Filter, Message, Room, Space } from "$lib/client/mock";
import RightPanel from "$lib/client/RightPanel.svelte";
import RoomList from "$lib/client/RoomList.svelte";
import Settings from "$lib/client/Settings.svelte";
import SpaceRail from "$lib/client/SpaceRail.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

let rooms = $state<Room[]>(untrack(() => data.rooms.map((r) => ({ ...r }))));
let spaces = $state<Space[]>(untrack(() => data.spaces.map((s) => ({ ...s }))));
let messages = $state<Record<string, Message[]>>(
	untrack(() => ({ ...data.messages })),
);
let prevBatch = $state<Record<string, string>>(
	untrack(() => ({ ...data.prevBatch })),
);
let typingByRoom = $state<Record<string, string[]>>({});
let me = $state(untrack(() => ({ ...data.me })));
let nextBatch = untrack(() => data.nextBatch);
const appliedReactions = new Set<string>();

let space = $state("home");
let selected = $state("");
let filter = $state<Filter>("All");
let query = $state("");
let rightOpen = $state(true);
let settingsOpen = $state(false);
let loadingOlder = $state(false);
let searchFocus = $state(0);

let mobile = $state(false);
let pane = $state<"list" | "room">("room");

const spaceName = $derived(
	space === "home"
		? "Home"
		: (spaces.find((s) => s.id === space)?.name ?? "Home"),
);
const visible = $derived(
	rooms.filter((r) => {
		if (space !== "home" && r.spaceId !== space) return false;
		if (filter === "Unread" && r.unread === 0) return false;
		if (filter === "DMs" && r.kind !== "dm") return false;
		if (filter === "Groups" && r.kind !== "group") return false;
		if (query && !r.name.toLowerCase().includes(query.toLowerCase()))
			return false;
		return true;
	}),
);
const room = $derived(rooms.find((r) => r.id === selected) ?? rooms[0]);
const roomMessages = $derived(room ? (messages[room.id] ?? []) : []);
const hasOlder = $derived(!!(room && prevBatch[room.id]));

function pickSpace(id: string) {
	space = id;
	pane = "list";
}
function openRoom(id: string) {
	selected = id;
	pane = "room";
	const last = (messages[id] ?? []).at(-1);
	if (last) sendRead(id, last.id);
	rooms = rooms.map((r) => (r.id === id ? { ...r, unread: 0 } : r));
}

async function post(path: string, body: unknown) {
	const res = await fetch(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	return res.json();
}

// --- message-store mutations ---
function appendMessage(roomId: string, m: Message) {
	const list = messages[roomId] ?? [];
	if (list.some((x) => x.id === m.id)) return;
	messages[roomId] = [...list, m];
	const idx = rooms.findIndex((r) => r.id === roomId);
	if (idx >= 0) {
		const updated = {
			...rooms[idx],
			last: m.body,
			lastSender: m.me ? "you" : m.sender,
			ts: m.ts,
		};
		rooms.splice(idx, 1);
		rooms.unshift(updated);
	}
}
function patchMessage(roomId: string, id: string, patch: Partial<Message>) {
	if (messages[roomId])
		messages[roomId] = messages[roomId].map((m) =>
			m.id === id ? { ...m, ...patch } : m,
		);
}
function removeMessage(roomId: string, id: string) {
	if (messages[roomId])
		messages[roomId] = messages[roomId].filter((m) => m.id !== id);
}
function bumpReaction(
	roomId: string,
	msgId: string,
	key: string,
	dir: number,
	mine?: boolean,
	eventId?: string,
) {
	if (!messages[roomId]) return;
	messages[roomId] = messages[roomId].map((m) => {
		if (m.id !== msgId) return m;
		const rs = (m.reactions ?? []).map((r) => ({ ...r }));
		let r = rs.find((x) => x.key === key);
		if (!r) {
			r = { key, count: 0, mine: false };
			rs.push(r);
		}
		r.count += dir;
		if (mine !== undefined) {
			r.mine = mine;
			r.myReactionId = mine ? eventId : undefined;
		}
		return { ...m, reactions: rs.filter((x) => x.count > 0) };
	});
}

// --- actions ---
async function send(content: Record<string, unknown>) {
	const r = room;
	if (!r) return;
	const { message } = await post("/api/send", { roomId: r.id, content });
	if (message) appendMessage(r.id, message);
}
async function react(messageId: string, key: string) {
	const r = room;
	if (!r) return;
	const m = (messages[r.id] ?? []).find((x) => x.id === messageId);
	const existing = m?.reactions?.find((x) => x.key === key);
	if (existing?.mine && existing.myReactionId) {
		const myRid = existing.myReactionId;
		bumpReaction(r.id, messageId, key, -1, false);
		await post("/api/redact", { roomId: r.id, eventId: myRid });
	} else {
		const d = await post("/api/react", {
			roomId: r.id,
			eventId: messageId,
			key,
		});
		if (d.eventId) appliedReactions.add(d.eventId);
		bumpReaction(r.id, messageId, key, +1, true, d.eventId);
	}
}
async function editMsg(id: string, text: string) {
	const r = room;
	if (!r) return;
	patchMessage(r.id, id, { body: text, edited: true });
	await post("/api/edit", { roomId: r.id, eventId: id, text });
}
async function deleteMsg(id: string) {
	const r = room;
	if (!r) return;
	removeMessage(r.id, id);
	await post("/api/redact", { roomId: r.id, eventId: id });
}
function sendTyping(t: boolean) {
	if (room) post("/api/typing", { roomId: room.id, typing: t });
}
function sendRead(roomId: string, eventId: string) {
	post("/api/read", { roomId, eventId });
}

async function newRoom() {
	const name = window.prompt("New room name");
	if (!name?.trim()) return;
	const { room: created } = await post("/api/room", { name });
	if (created) {
		rooms = [created, ...rooms];
		messages[created.id] = [];
		space = "home";
		openRoom(created.id);
	}
}
async function createSpace() {
	const name = window.prompt("New space name");
	if (!name?.trim()) return;
	const { space: created } = await post("/api/space", { name });
	if (created) {
		spaces = [...spaces, created];
		pickSpace(created.id);
	}
}
async function saveName(name: string) {
	const d = await post("/api/profile", { name });
	if (d.name)
		me = { ...me, name: d.name, glyph: d.name.charAt(0).toUpperCase() };
}
async function logout() {
	await fetch("/api/logout", { method: "POST" });
	location.href = "/login";
}
async function loadOlder() {
	const r = room;
	if (!r || loadingOlder) return;
	const from = prevBatch[r.id];
	if (!from) return;
	loadingOlder = true;
	try {
		const res = await fetch(
			`/api/messages?roomId=${encodeURIComponent(r.id)}&from=${encodeURIComponent(from)}`,
		);
		const d = await res.json();
		const have = new Set((messages[r.id] ?? []).map((m) => m.id));
		const older = (d.messages ?? []).filter((m: Message) => !have.has(m.id));
		messages[r.id] = [...older, ...(messages[r.id] ?? [])];
		prevBatch[r.id] = d.end && d.end !== from && older.length ? d.end : "";
	} finally {
		loadingOlder = false;
	}
}

function applyDelta(
	rid: string,
	delta: import("$lib/server/matrix").RoomDelta,
) {
	for (const m of delta.messages ?? []) appendMessage(rid, m);
	for (const e of delta.edits ?? [])
		patchMessage(rid, e.id, { body: e.body, edited: true });
	for (const rx of delta.reactions ?? []) {
		if (rx.eventId && appliedReactions.has(rx.eventId)) continue;
		if (rx.eventId) appliedReactions.add(rx.eventId);
		bumpReaction(
			rid,
			rx.target,
			rx.key,
			+1,
			rx.mine ? true : undefined,
			rx.eventId,
		);
	}
	for (const id of delta.removed ?? []) removeMessage(rid, id);
	if (delta.unread !== undefined) {
		const val = rid === room?.id ? 0 : delta.unread;
		rooms = rooms.map((r) => (r.id === rid ? { ...r, unread: val } : r));
	}
	if (rid === room?.id && delta.messages?.length)
		sendRead(rid, delta.messages.at(-1)?.id ?? "");
}

onMount(() => {
	const mq = window.matchMedia("(max-width: 760px)");
	const applyMq = () => {
		mobile = mq.matches;
	};
	applyMq();
	mq.addEventListener("change", applyMq);

	const onKeydown = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			searchFocus++;
		}
	};
	window.addEventListener("keydown", onKeydown);

	let stopped = false;
	(async () => {
		while (!stopped) {
			try {
				const res = await fetch(
					`/api/sync?since=${encodeURIComponent(nextBatch)}`,
				);
				const d = await res.json();
				nextBatch = d.nextBatch ?? nextBatch;
				for (const [rid, delta] of Object.entries(d.rooms ?? {})) {
					applyDelta(rid, delta as import("$lib/server/matrix").RoomDelta);
				}
				if (d.typing) typingByRoom = { ...typingByRoom, ...d.typing };
			} catch {
				await new Promise((r) => setTimeout(r, 2500));
			}
		}
	})();

	return () => {
		stopped = true;
		mq.removeEventListener("change", applyMq);
		window.removeEventListener("keydown", onKeydown);
	};
});
</script>

<svelte:head><title>hoot</title></svelte:head>

{#if !data.ok}
	<div class="err">
		<h1>🦉 hoot — can't reach the homeserver</h1>
		<p>{data.error ?? "unknown error"}</p>
		<p class="dim">target: {data.server}</p>
	</div>
{:else}
	<div class="app" class:has-right={rightOpen && room && !mobile} class:mobile data-pane={pane}>
		<SpaceRail {spaces} {me} active={space} onSelect={pickSpace} onSettings={() => (settingsOpen = true)} onCreateSpace={createSpace} />

		<RoomList
			title={spaceName}
			rooms={visible}
			{filter}
			onFilter={(f) => (filter = f)}
			{query}
			onQuery={(q) => (query = q)}
			{searchFocus}
			selected={room?.id ?? ""}
			onSelect={openRoom}
			onNewRoom={newRoom}
		/>

		<ChatView
			{room}
			messages={roomMessages}
			{rightOpen}
			{hasOlder}
			typing={typingByRoom[room?.id ?? ""] ?? []}
			onToggleRight={() => (rightOpen = !rightOpen)}
			onBack={() => (pane = "list")}
			onSend={send}
			onEdit={editMsg}
			onReact={react}
			onDelete={deleteMsg}
			onLoadOlder={loadOlder}
			onTyping={sendTyping}
			{mobile}
		/>

		{#if rightOpen && room && !mobile}
			<RightPanel {room} members={data.members[room.id] ?? []} messages={roomMessages} onClose={() => (rightOpen = false)} />
		{/if}
	</div>

	{#if settingsOpen}
		<Settings {me} server={data.server} roomCount={rooms.length} spaceCount={spaces.length} onClose={() => (settingsOpen = false)} onSaveName={saveName} onLogout={logout} />
	{/if}
{/if}

<style>
.app {
	display: grid;
	grid-template-columns: 64px 304px 1fr;
	grid-template-areas: "rail list chat";
	height: 100vh;
	height: 100dvh;
	overflow: hidden;
}
.app.has-right {
	grid-template-columns: 64px 304px 1fr 312px;
	grid-template-areas: "rail list chat right";
}
.app.mobile {
	grid-template-columns: 64px 1fr;
	grid-template-areas: "rail main";
}
.app.mobile :global(.list),
.app.mobile :global(.chat) {
	grid-area: main;
}
.app.mobile :global(.info) {
	display: none;
}
.app.mobile[data-pane="room"] :global(.list) {
	display: none;
}
.app.mobile[data-pane="list"] :global(.chat) {
	display: none;
}
.err {
	max-width: 560px;
	margin: 18vh auto;
	padding: 0 24px;
	text-align: center;
}
.err h1 {
	font-size: 22px;
}
.err p {
	color: var(--text-dim);
}
.err .dim {
	color: var(--muted);
	font-size: 13px;
}
</style>
