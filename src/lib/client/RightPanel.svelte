<script lang="ts">
import type { Member, Message, Room } from "./mock";

let {
	room,
	members,
	messages,
	onClose,
}: { room: Room; members: Member[]; messages: Message[]; onClose: () => void } =
	$props();

const online = $derived(members.filter((m) => m.online));
const offline = $derived(members.filter((m) => !m.online));
const files = $derived(
	messages.filter((m) => m.kind === "image" || m.kind === "file"),
);
let tab = $state<"members" | "files" | "pinned">("members");
</script>

<aside class="info" aria-label="Room info">
	<header class="head">
		<span>Room info</span>
		<button class="x" title="Close" aria-label="Close" onclick={onClose}>
			<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
		</button>
	</header>

	<div class="hero">
		<span class="av" class:dm={room.kind === "dm"} style="--c:{room.color}">{room.glyph}</span>
		<strong>{room.name}</strong>
		<span class="sub">
			{room.kind === "dm" ? "Direct message" : `${room.memberCount ?? members.length} members`}
		</span>
		<p class="topic">{room.topic ?? "No topic set."}</p>
	</div>

	<div class="quick">
		<button class:on={tab === "members"} onclick={() => (tab = "members")}>Members</button>
		<button class:on={tab === "files"} onclick={() => (tab = "files")}>Files</button>
		<button class:on={tab === "pinned"} onclick={() => (tab = "pinned")}>Pinned</button>
	</div>

	{#if tab === "members"}
		<div class="members">
			<h4>Online — {online.length}</h4>
			{#each online as m (m.name)}
				<div class="m">
					<span class="ma" style="--c:{m.color}">{m.name[0]?.toUpperCase() ?? "?"}<i></i></span>
					<span class="mn">{m.name}</span>
					{#if m.role !== "Member"}<span class="role">{m.role}</span>{/if}
				</div>
			{/each}
			{#if offline.length}
				<h4>Offline — {offline.length}</h4>
				{#each offline as m (m.name)}
					<div class="m off">
						<span class="ma" style="--c:{m.color}">{m.name[0]?.toUpperCase() ?? "?"}</span>
						<span class="mn">{m.name}</span>
						{#if m.role !== "Member"}<span class="role">{m.role}</span>{/if}
					</div>
				{/each}
			{/if}
		</div>
	{:else if tab === "files"}
		<div class="files">
			{#if files.length === 0}
				<p class="empty">No files shared yet.</p>
			{:else}
				<div class="fgrid">
					{#each files as f (f.id)}
						{#if f.kind === "image" && f.url}
							<a class="fthumb" href={f.url} target="_blank" rel="noreferrer" title={f.name}>
								<img src={f.url} alt={f.name ?? "image"} loading="lazy" />
							</a>
						{:else}
							<a class="frow" href={f.url} target="_blank" rel="noreferrer" download={f.name}>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
								<span>{f.name ?? f.body}</span>
							</a>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="files"><p class="empty">Nothing pinned yet.</p></div>
	{/if}
</aside>

<style>
.info {
	grid-area: right;
	display: flex;
	flex-direction: column;
	min-height: 0;
	background: var(--panel);
	border-left: 1px solid var(--border);
}
.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 13px 14px;
	border-bottom: 1px solid var(--border);
	font-size: 13px;
	font-weight: 700;
	color: var(--text-dim);
}
.x {
	width: 28px;
	height: 28px;
	border-radius: 8px;
	border: none;
	background: transparent;
	color: var(--muted);
	cursor: pointer;
	display: grid;
	place-items: center;
}
.x:hover {
	background: var(--surface);
	color: var(--text);
}
.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	gap: 5px;
	padding: 18px 16px 14px;
	border-bottom: 1px solid var(--border);
}
.av {
	width: 64px;
	height: 64px;
	border-radius: 18px;
	display: grid;
	place-items: center;
	font-size: 27px;
	font-weight: 800;
	color: #0b0c10;
	background: var(--c);
	margin-bottom: 4px;
}
.av.dm {
	border-radius: 50%;
}
.hero strong {
	font-size: 16px;
}
.sub {
	font-size: 12px;
	color: var(--muted);
}
.topic {
	font-size: 12.5px;
	color: var(--text-dim);
	margin: 6px 0 0;
	line-height: 1.5;
}
.quick {
	display: flex;
	gap: 8px;
	padding: 12px 14px;
	border-bottom: 1px solid var(--border);
}
.quick button {
	flex: 1;
	padding: 7px 0;
	border-radius: 9px;
	border: 1px solid var(--border);
	background: var(--surface);
	color: var(--text-dim);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
}
.quick button:hover {
	border-color: var(--border-hi);
	color: var(--text);
}
.quick button.on {
	background: color-mix(in srgb, var(--accent) 18%, transparent);
	border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	color: var(--text);
}
.files {
	flex: 1;
	overflow-y: auto;
	padding: 12px;
}
.fgrid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}
.fthumb {
	display: block;
	aspect-ratio: 1;
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid var(--border);
}
.fthumb img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.frow {
	grid-column: 1 / -1;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 9px 11px;
	border-radius: 9px;
	border: 1px solid var(--border);
	background: var(--surface);
	color: var(--text-dim);
	text-decoration: none;
	font-size: 13px;
}
.frow:hover {
	border-color: var(--border-hi);
	color: var(--text);
}
.frow svg {
	color: var(--accent);
	flex: none;
}
.frow span {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.empty {
	color: var(--muted);
	font-size: 13px;
	text-align: center;
	margin-top: 24px;
}
.members {
	flex: 1;
	overflow-y: auto;
	padding: 8px 8px 14px;
}
.members h4 {
	margin: 10px 8px 6px;
	font-size: 11px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--muted);
}
.m {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 8px;
	border-radius: 9px;
	cursor: pointer;
}
.m:hover {
	background: var(--surface);
}
.m.off {
	opacity: 0.55;
}
.ma {
	position: relative;
	width: 30px;
	height: 30px;
	flex: none;
	border-radius: 50%;
	display: grid;
	place-items: center;
	font-weight: 700;
	font-size: 12px;
	color: #0b0c10;
	background: var(--c);
}
.ma i {
	position: absolute;
	right: -1px;
	bottom: -1px;
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: var(--good);
	border: 2px solid var(--panel);
}
.mn {
	flex: 1;
	font-size: 13.5px;
}
.role {
	font-size: 10.5px;
	font-weight: 700;
	color: var(--accent-2);
	background: color-mix(in srgb, var(--accent-2) 16%, transparent);
	border-radius: 6px;
	padding: 1px 6px;
}
</style>
