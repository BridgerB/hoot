<script lang="ts">
import { Direction } from "matrix-js-sdk";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import ChatView from "$lib/client/ChatView.svelte";
import { type Filter } from "$lib/client/mock";
import RightPanel from "$lib/client/RightPanel.svelte";
import RoomList from "$lib/client/RoomList.svelte";
import Settings from "$lib/client/Settings.svelte";
import SpaceRail from "$lib/client/SpaceRail.svelte";
import {
	enableNotifications,
	encryptionStatus,
	getClient,
	logout,
	mx,
	notificationPermission,
	restore,
	setupEncryption,
	unlockEncryption,
} from "$lib/matrix.svelte";
import {
	listRooms,
	meInfo,
	roomMembers,
	roomMessages,
	roomTyping,
	searchRoom,
} from "$lib/matrix-map";

let booted = $state(false);
onMount(async () => {
	if (!(await restore())) {
		await goto("/login");
		return;
	}
	booted = true;
});

let space = $state("home");
let selected = $state("");
let filter = $state<Filter>("All");
let query = $state("");
let rightOpen = $state(true);
let settingsOpen = $state(false);
let encState = $state({
	crypto: false,
	crossSigning: false,
	secretStorage: false,
	backup: null as string | null,
});
async function refreshEnc() {
	encState = await encryptionStatus();
}
function openSettings() {
	settingsOpen = true;
	void refreshEnc();
}
let searchFocus = $state(0);
let mobile = $state(false);
let pane = $state<"list" | "room">("room");

// everything re-derives when the SDK bumps mx.rev
const sdk = $derived.by(() => {
	void mx.rev;
	const c = getClient();
	return c ? listRooms(c, mx.userId) : { spaces: [], rooms: [] };
});
const myName = $derived.by(() => {
	void mx.rev;
	return (
		getClient()?.getUser(mx.userId)?.displayName ??
		mx.userId.replace(/^@/, "").split(":")[0]
	);
});
const me = $derived(meInfo(mx.userId, myName));

const spaceName = $derived(
	space === "home"
		? "Home"
		: (sdk.spaces.find((s) => s.id === space)?.name ?? "Home"),
);
const visible = $derived(
	sdk.rooms.filter((r) => {
		if (space !== "home" && r.spaceId !== space) return false;
		if (filter === "Unread" && r.unread === 0) return false;
		if (filter === "DMs" && r.kind !== "dm") return false;
		if (filter === "Groups" && r.kind !== "group") return false;
		if (query && !r.name.toLowerCase().includes(query.toLowerCase()))
			return false;
		return true;
	}),
);
const room = $derived(sdk.rooms.find((r) => r.id === selected) ?? sdk.rooms[0]);
const messages = $derived.by(() => {
	void mx.rev;
	const c = getClient();
	return room && c ? roomMessages(c, room.id, mx.userId) : [];
});
const members = $derived.by(() => {
	void mx.rev;
	const c = getClient();
	return room && c ? roomMembers(c, room.id, mx.userId) : [];
});
const typing = $derived.by(() => {
	void mx.rev;
	const c = getClient();
	return room && c ? roomTyping(c, room.id, mx.userId) : [];
});
const hasOlder = $derived.by(() => {
	void mx.rev;
	const tl = room && getClient()?.getRoom(room.id)?.getLiveTimeline();
	return !!tl?.getPaginationToken(Direction.Backward);
});

function openRoom(id: string) {
	selected = id;
	pane = "room";
	const c = getClient();
	const tl = c?.getRoom(id)?.getLiveTimeline();
	const last = tl?.getEvents().at(-1);
	if (c && last?.getId()) c.sendReadReceipt(last);
}
function pickSpace(id: string) {
	space = id;
	pane = "list";
}

// --- actions wired straight to the SDK (local echo + sync handle the UI) ---
function send(content: Record<string, unknown>) {
	const c = getClient();
	// biome-ignore lint/suspicious/noExplicitAny: SDK event content
	if (c && room) c.sendEvent(room.id, "m.room.message" as any, content as any);
}
function react(id: string, key: string) {
	const c = getClient();
	if (c && room)
		// biome-ignore lint/suspicious/noExplicitAny: SDK event content
		c.sendEvent(
			room.id,
			"m.reaction" as any,
			{
				"m.relates_to": { rel_type: "m.annotation", event_id: id, key },
				// biome-ignore lint/suspicious/noExplicitAny: SDK event content
			} as any,
		);
}
function editMsg(id: string, text: string) {
	const c = getClient();
	if (c && room)
		// biome-ignore lint/suspicious/noExplicitAny: SDK event content
		c.sendEvent(
			room.id,
			"m.room.message" as any,
			{
				msgtype: "m.text",
				body: `* ${text}`,
				"m.new_content": { msgtype: "m.text", body: text },
				"m.relates_to": { rel_type: "m.replace", event_id: id },
				// biome-ignore lint/suspicious/noExplicitAny: SDK event content
			} as any,
		);
}
function deleteMsg(id: string) {
	const c = getClient();
	if (c && room) c.redactEvent(room.id, id);
}
async function uploadFile(file: File): Promise<string> {
	const c = getClient();
	if (!c) return "";
	const res = await c.uploadContent(file, { name: file.name, type: file.type });
	return res.content_uri;
}
function sendTyping(t: boolean) {
	const c = getClient();
	if (c && room) c.sendTyping(room.id, t, t ? 6000 : 0);
}
async function loadOlder() {
	const c = getClient();
	const tl = room && c?.getRoom(room.id)?.getLiveTimeline();
	if (c && tl) {
		await c.paginateEventTimeline(tl, { backwards: true, limit: 30 });
		mx.rev++;
	}
}
async function newRoom() {
	const name = window.prompt("New room name");
	const c = getClient();
	if (!name?.trim() || !c) return;
	const encrypted = mx.crypto && window.confirm("End-to-end encrypted room?");
	const { room_id } = await c.createRoom({
		name: name.trim(),
		...(encrypted
			? {
					initial_state: [
						{
							type: "m.room.encryption",
							state_key: "",
							content: { algorithm: "m.megolm.v1.aes-sha2" },
						},
					],
				}
			: {}),
	});
	openRoom(room_id);
}
async function createSpace() {
	const name = window.prompt("New space name");
	const c = getClient();
	if (name?.trim() && c) {
		await c.createRoom({
			name: name.trim(),
			creation_content: { type: "m.space" },
		});
	}
}
async function saveName(name: string) {
	await getClient()?.setDisplayName(name);
	mx.rev++;
}
async function doLogout() {
	await logout();
	await goto("/login");
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
	return () => {
		mq.removeEventListener("change", applyMq);
		window.removeEventListener("keydown", onKeydown);
	};
});
</script>

<svelte:head><title>hoot</title></svelte:head>

{#if !booted || mx.status === "syncing" || mx.status === "connecting"}
	<div class="boot"><div class="owl">🦉</div><p>Connecting…</p></div>
{:else}
	<div class="app" class:has-right={rightOpen && room && !mobile} class:mobile data-pane={pane}>
		<SpaceRail spaces={sdk.spaces} {me} active={space} onSelect={pickSpace} onSettings={openSettings} onCreateSpace={createSpace} />

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
			{messages}
			{rightOpen}
			{hasOlder}
			{typing}
			onToggleRight={() => (rightOpen = !rightOpen)}
			onBack={() => (pane = "list")}
			onSend={send}
			onEdit={editMsg}
			onReact={react}
			onDelete={deleteMsg}
			onLoadOlder={loadOlder}
			onTyping={sendTyping}
			onSearch={(term) => {
				const c = getClient();
				return c && room ? searchRoom(c, room.id, term, mx.userId) : Promise.resolve([]);
			}}
			onUpload={uploadFile}
			{mobile}
		/>

		{#if rightOpen && room && !mobile}
			<RightPanel {room} {members} {messages} onClose={() => (rightOpen = false)} />
		{/if}
	</div>

	{#if settingsOpen}
		<Settings
			{me}
			server={getClient()?.baseUrl ?? ""}
			roomCount={sdk.rooms.length}
			spaceCount={sdk.spaces.length}
			encryption={encState}
			notifPermission={notificationPermission()}
			onClose={() => (settingsOpen = false)}
			onSaveName={saveName}
			onEnableNotifications={enableNotifications}
			onSetupEncryption={async (pw) => {
				const rk = await setupEncryption(pw);
				await refreshEnc();
				return rk;
			}}
			onUnlockEncryption={async (rk) => {
				await unlockEncryption(rk);
				await refreshEnc();
			}}
			onLogout={doLogout}
		/>
	{/if}
{/if}

<style>
.boot {
	min-height: 100dvh;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 8px;
	color: var(--muted);
}
.boot .owl {
	font-size: 48px;
	opacity: 0.6;
}
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
</style>
