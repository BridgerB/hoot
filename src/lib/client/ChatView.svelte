<script lang="ts">
import type { Sticker } from "$lib/stickers";
import EmojiPicker from "./EmojiPicker.svelte";
import { renderMarkdown } from "./md";
import type { Message, Room } from "./mock";

let {
	room,
	messages,
	rightOpen,
	hasOlder,
	typing,
	onToggleRight,
	onBack,
	onSend,
	onEdit,
	onReact,
	onDelete,
	onLoadOlder,
	onTyping,
	onSearch,
	onUpload,
	onShareLocation,
	onCreatePoll,
	onVote,
	onCall,
	onJoinCall,
	groupCallActive,
	onOpenThread,
	stickers,
	onSticker,
	mobile,
}: {
	room: Room | undefined;
	messages: Message[];
	rightOpen: boolean;
	hasOlder: boolean;
	typing: string[];
	onToggleRight: () => void;
	onBack: () => void;
	onSend: (content: Record<string, unknown>) => void;
	onEdit: (id: string, text: string) => void;
	onReact: (id: string, key: string) => void;
	onDelete: (id: string) => void;
	onLoadOlder: () => void;
	onTyping: (t: boolean) => void;
	onSearch: (term: string) => Promise<Message[]>;
	onUpload: (file: File) => Promise<string>;
	onShareLocation: () => void;
	onCreatePoll: (question: string, options: string[]) => void;
	onVote: (pollId: string, answerId: string) => void;
	onCall: (video: boolean) => void;
	onJoinCall: () => void;
	groupCallActive: boolean;
	onOpenThread: (rootId: string) => void;
	stickers: Sticker[];
	onSticker: (s: Sticker) => void;
	mobile: boolean;
} = $props();

let stickerOpen = $state(false);

const QUICK = ["👍", "❤️", "😂", "🎉", "👀"];

let draft = $state("");
let streamEl = $state<HTMLDivElement>();
let fileInput = $state<HTMLInputElement>();
let searching = $state(false);
let q = $state("");
let serverResults = $state<Message[]>([]);
let searchBusy = $state(false);
let replyTo = $state<Message | null>(null);
let editing = $state<Message | null>(null);
let pickerFor = $state<string | null>(null);
let pickerAnchor = $state<DOMRect | null>(null);

const byId = $derived(new Map(messages.map((m) => [m.id, m])));
// loaded-timeline matches (instant) merged with full-history server results
const filtered = $derived.by(() => {
	if (!q.trim()) return messages;
	const local = messages.filter((m) =>
		m.body.toLowerCase().includes(q.toLowerCase()),
	);
	const map = new Map(local.map((m) => [m.id, m]));
	for (const m of serverResults) map.set(m.id, m);
	return [...map.values()].sort((a, b) => a.tsMs - b.tsMs);
});

async function runSearch() {
	const term = q.trim();
	if (!term) {
		serverResults = [];
		return;
	}
	searchBusy = true;
	try {
		serverResults = await onSearch(term);
	} catch {
		serverResults = [];
	}
	searchBusy = false;
}
type Row = { sep: true; label: string } | { sep: false; m: Message };
const rows = $derived.by((): Row[] => {
	if (q.trim()) return filtered.map((m) => ({ sep: false, m }));
	const out: Row[] = [];
	let last = "";
	for (const m of filtered) {
		const l = dayLabel(m.tsMs);
		if (l !== last) {
			out.push({ sep: true, label: l });
			last = l;
		}
		out.push({ sep: false, m });
	}
	return out;
});

function dayLabel(ts: number): string {
	const startOf = (x: Date) =>
		new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const diff = Math.round(
		(startOf(new Date()) - startOf(new Date(ts))) / 86400000,
	);
	if (diff <= 0) return "Today";
	if (diff === 1) return "Yesterday";
	return new Date(ts).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

function submit() {
	const text = draft.trim();
	if (!text) return;
	if (editing) {
		onEdit(editing.id, text);
		editing = null;
	} else if (replyTo) {
		onSend({
			msgtype: "m.text",
			body: `> <${replyTo.senderId ?? replyTo.sender}> ${replyTo.body}\n\n${text}`,
			"m.relates_to": { "m.in_reply_to": { event_id: replyTo.id } },
		});
		replyTo = null;
	} else {
		onSend({ msgtype: "m.text", body: text });
	}
	draft = "";
	stopTyping();
}
function onKey(e: KeyboardEvent) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		submit();
	} else if (e.key === "Escape") {
		editing = null;
		replyTo = null;
	}
}
function startReply(m: Message) {
	replyTo = m;
	editing = null;
}
function startEdit(m: Message) {
	editing = m;
	replyTo = null;
	draft = m.body;
}

// typing notifications (throttled)
let typingActive = false;
let typingTimer: ReturnType<typeof setTimeout>;
function notifyTyping() {
	if (!typingActive) {
		typingActive = true;
		onTyping(true);
	}
	clearTimeout(typingTimer);
	typingTimer = setTimeout(stopTyping, 4000);
}
function stopTyping() {
	clearTimeout(typingTimer);
	if (typingActive) {
		typingActive = false;
		onTyping(false);
	}
}

async function onPickFile(e: Event) {
	const input = e.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file) return;
	const mxc = await onUpload(file);
	if (!mxc) return;
	onSend({
		msgtype: file.type.startsWith("image/") ? "m.image" : "m.file",
		body: file.name,
		url: mxc,
		info: { mimetype: file.type, size: file.size },
	});
}

// --- voice messages (MediaRecorder -> m.audio + MSC3245) ---
let recording = $state(false);
let recSecs = $state(0);
let mediaRec: MediaRecorder | undefined;
let recChunks: Blob[] = [];
let recTimer: ReturnType<typeof setInterval>;
let recStart = 0;
let recCancelled = false;

async function computeWaveform(blob: Blob): Promise<number[]> {
	try {
		const ctx = new AudioContext();
		const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
		const data = buf.getChannelData(0);
		const N = 50;
		const block = Math.max(1, Math.floor(data.length / N));
		const out: number[] = [];
		for (let i = 0; i < N; i++) {
			let sum = 0;
			for (let j = 0; j < block; j++) sum += Math.abs(data[i * block + j] || 0);
			out.push(Math.min(1024, Math.round((sum / block) * 4096)));
		}
		ctx.close();
		return out;
	} catch {
		return [];
	}
}

async function startRec() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		recChunks = [];
		recCancelled = false;
		mediaRec = new MediaRecorder(stream);
		mediaRec.ondataavailable = (e) => recChunks.push(e.data);
		mediaRec.onstop = async () => {
			for (const t of stream.getTracks()) t.stop();
			if (recCancelled) return;
			const blob = new Blob(recChunks, {
				type: mediaRec?.mimeType || "audio/webm",
			});
			const durationMs = Date.now() - recStart;
			const waveform = await computeWaveform(blob);
			const mxc = await onUpload(
				new File([blob], "voice.webm", { type: blob.type }),
			);
			if (!mxc) return;
			onSend({
				body: "Voice message",
				msgtype: "m.audio",
				url: mxc,
				info: { duration: durationMs, mimetype: blob.type, size: blob.size },
				"org.matrix.msc1767.text": "Voice message",
				"org.matrix.msc1767.audio": { duration: durationMs, waveform },
				"org.matrix.msc3245.voice": {},
			});
		};
		recStart = Date.now();
		mediaRec.start();
		recording = true;
		recSecs = 0;
		recTimer = setInterval(() => recSecs++, 1000);
	} catch {
		recording = false;
	}
}
function stopRec(cancel = false) {
	clearInterval(recTimer);
	recCancelled = cancel;
	recording = false;
	mediaRec?.stop();
}

// --- poll creation ---
let pollOpen = $state(false);
let pollQ = $state("");
let pollOpts = $state(["", ""]);
function submitPoll() {
	const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
	if (!pollQ.trim() || opts.length < 2) return;
	onCreatePoll(pollQ.trim(), opts);
	pollOpen = false;
	pollQ = "";
	pollOpts = ["", ""];
}

let lastId = "";
$effect(() => {
	const id = messages.at(-1)?.id ?? "";
	if (id !== lastId) {
		lastId = id;
		queueMicrotask(() => {
			if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
		});
	}
});

function toggleSearch() {
	searching = !searching;
	if (!searching) {
		q = "";
		serverResults = [];
	}
}
</script>

<section class="chat" aria-label="Conversation">
	{#if room}
		<header class="bar">
			{#if mobile}
				<button class="hd" title="Back" aria-label="Back" onclick={onBack}>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
				</button>
			{/if}
			{#if searching}
				<svg class="sicon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
				<!-- svelte-ignore a11y_autofocus -->
				<input class="sinput" placeholder="Search in {room.name} — Enter for full history" bind:value={q} autofocus onkeydown={(e) => e.key === "Enter" && runSearch()} />
				<span class="scount">{searchBusy ? "searching…" : q.trim() ? `${filtered.length} found` : ""}</span>
				<button class="hd" title="Close search" aria-label="Close search" onclick={toggleSearch}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
				</button>
			{:else}
				<span class="av" class:dm={room.kind === "dm"} style="--c:{room.color}">{room.glyph}</span>
				<div class="meta">
					<strong>{room.encrypted ? "🔒 " : ""}{room.name}</strong>
					<span class="topic">
						{room.kind === "dm" ? "Direct message" : `${room.memberCount ?? 0} members${room.topic ? ` · ${room.topic}` : ""}`}
					</span>
				</div>
				<div class="actions">
					<button class="hd" title="Voice call" aria-label="Voice call" onclick={() => onCall(false)}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
					</button>
					<button class="hd" title="Video call" aria-label="Video call" onclick={() => onCall(true)}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m23 7-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
					</button>
					<button class="hd" title="Search in room" aria-label="Search in room" onclick={toggleSearch}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
					</button>
					<button class="hd" class:on={rightOpen} title="Room info" aria-label="Room info" onclick={onToggleRight}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>
					</button>
				</div>
			{/if}
		</header>

		<div class="stream" bind:this={streamEl}>
			{#if hasOlder && !searching}
				<div class="older"><button onclick={onLoadOlder}>↑ Load older messages</button></div>
			{/if}
			{#each rows as row (row.sep ? `sep-${row.label}` : row.m.id)}
				{#if row.sep}
					<div class="daysep"><span>{row.label}</span></div>
				{:else}
					{@const m = row.m}
					<div class="msg" class:me={m.me}>
						<span class="mav" style="--c:{m.color}">{m.sender[0]?.toUpperCase() ?? "?"}</span>
						<div class="bubblewrap">
							<div class="who">
								<span class="sn" style="color:{m.color}">{m.sender}</span>
								<span class="mt">{m.ts}{m.edited ? " · edited" : ""}</span>
							</div>
							{#if m.replyToId}
								{@const t = byId.get(m.replyToId)}
								<div class="reply">↩ {t ? `${t.sender}: ${t.body.slice(0, 60)}` : "in reply to a message"}</div>
							{/if}
							{#if m.kind === "image" && m.url}
								<a class="imgbubble" href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.name ?? "image"} loading="lazy" /></a>
							{:else if m.kind === "audio" && m.url}
								<div class="audiobubble">
									<!-- svelte-ignore a11y_media_has_caption -->
									<audio controls src={m.url}></audio>
									{#if m.duration}<span class="adur">{Math.round(m.duration / 1000)}s</span>{/if}
								</div>
							{:else if m.kind === "poll" && m.poll}
								<div class="pollbubble">
									<div class="pollq">📊 {m.poll.question}</div>
									{#each m.poll.options as opt (opt.id)}
										<button class="pollopt" class:mine={opt.mine} onclick={() => m.poll && onVote(m.poll.id, opt.id)}>
											<span class="pollbar" style="width:{m.poll.totalVotes ? (opt.votes / m.poll.totalVotes) * 100 : 0}%"></span>
											<span class="polltext">{opt.text}</span>
											<span class="pollcount">{opt.votes}</span>
										</button>
									{/each}
									<div class="pollmeta">{m.poll.totalVotes} vote{m.poll.totalVotes === 1 ? "" : "s"}{m.poll.ended ? " · ended" : ""}</div>
								</div>
							{:else if m.kind === "location" && m.lat != null && m.lng != null}
								<a class="locbubble" href="https://www.openstreetmap.org/?mlat={m.lat}&mlon={m.lng}#map=16/{m.lat}/{m.lng}" target="_blank" rel="noreferrer">
									<span class="locpin">📍</span>
									<span class="loctext"><b>Shared location</b><br />{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</span>
									<span class="locopen">Open ↗</span>
								</a>
							{:else if m.kind === "file" && m.url}
								<a class="filebubble" href={m.url} target="_blank" rel="noreferrer" download={m.name}>
									<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
									<span>{m.name ?? m.body}</span>
								</a>
							{:else}
								<!-- eslint-disable-next-line -->
								<div class="bubble">{@html renderMarkdown(m.body)}</div>
							{/if}
							{#if m.reactions && m.reactions.length}
								<div class="reacts">
									{#each m.reactions as r (r.key)}
										<button class="react" class:mine={r.mine} onclick={() => onReact(m.id, r.key)}>{r.key} {r.count}</button>
									{/each}
								</div>
							{/if}
							{#if m.threadCount}
								<button class="threadbtn" onclick={() => onOpenThread(m.id)}>
									<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>
									{m.threadCount} {m.threadCount === 1 ? "reply" : "replies"}
								</button>
							{/if}
							{#if m.readBy && m.readBy.length}
								<div class="readby">
									{#each m.readBy.slice(0, 5) as r (r.id)}
										<span class="rr" style="--c:{r.color}" title="Seen by {r.name}">{r.name[0]?.toUpperCase() ?? "?"}</span>
									{/each}
								</div>
							{/if}
						</div>
						<div class="menu">
							{#each QUICK as emoji (emoji)}
								<button title="React {emoji}" onclick={() => onReact(m.id, emoji)}>{emoji}</button>
							{/each}
							<button class="more" title="More emoji" aria-label="More emoji" onclick={(e) => { pickerFor = m.id; pickerAnchor = (e.currentTarget as HTMLElement).getBoundingClientRect(); }}>＋</button>
							<button title="Reply" aria-label="Reply" onclick={() => startReply(m)}>
								<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17l-5-5 5-5" /><path d="M4 12h11a5 5 0 0 1 5 5v1" /></svg>
							</button>
							<button title="Reply in thread" aria-label="Reply in thread" onclick={() => onOpenThread(m.id)}>
								<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>
							</button>
							{#if m.me && m.kind !== "image" && m.kind !== "file"}
								<button title="Edit" aria-label="Edit" onclick={() => startEdit(m)}>
									<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
								</button>
							{/if}
							{#if m.me}
								<button class="del" title="Delete" aria-label="Delete" onclick={() => onDelete(m.id)}>
									<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
								</button>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
			{#if rows.length === 0}
				<p class="noresults">{q.trim() ? "No messages match." : "No messages yet — say hi 👋"}</p>
			{/if}
		</div>

		{#if groupCallActive}
			<div class="callbanner">
				<span>📹 Group call in progress</span>
				<button onclick={onJoinCall}>Join</button>
			</div>
		{/if}

		{#if typing.length}
			<div class="typing">{typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…</div>
		{/if}

		{#if editing}
			<div class="banner">✏️ Editing message <button onclick={() => { editing = null; draft = ""; }}>cancel</button></div>
		{:else if replyTo}
			<div class="banner">↩ Replying to <b>{replyTo.sender}</b>: {replyTo.body.slice(0, 50)} <button onclick={() => (replyTo = null)}>cancel</button></div>
		{/if}

		{#if stickerOpen}
			<div class="stickerpanel">
				{#if stickers.length}
					<div class="sgrid">
						{#each stickers as s (s.shortcode + s.mxc)}
							<button class="sitem" title={s.body} onclick={() => { onSticker(s); stickerOpen = false; }}>
								<img src={s.httpUrl} alt={s.body} loading="lazy" />
							</button>
						{/each}
					</div>
				{:else}
					<p class="sempty">No sticker packs. Add an <code>im.ponies</code> pack (e.g. in Element) and it'll show up here.</p>
				{/if}
			</div>
		{/if}

		{#if pollOpen}
			<div class="pollcreate">
				<input class="pollinput" placeholder="Ask a question…" bind:value={pollQ} />
				{#each pollOpts as _opt, i (i)}
					<input class="pollinput" placeholder="Option {i + 1}" bind:value={pollOpts[i]} />
				{/each}
				<div class="pollcreate-actions">
					<button onclick={() => (pollOpts = [...pollOpts, ""])}>+ option</button>
					<span class="spacer"></span>
					<button onclick={() => (pollOpen = false)}>cancel</button>
					<button class="primary" onclick={submitPoll}>Create poll</button>
				</div>
			</div>
		{/if}

		<div class="composer">
			{#if recording}
				<span class="recdot"></span>
				<span class="rectime">Recording… {recSecs}s</span>
				<button class="hd" title="Cancel" aria-label="Cancel recording" onclick={() => stopRec(true)}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
				</button>
				<button class="send" title="Send voice message" aria-label="Send voice message" onclick={() => stopRec(false)}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>
				</button>
			{:else}
				<input class="hidden" type="file" bind:this={fileInput} onchange={onPickFile} />
				<button class="hd" title="Attach file" aria-label="Attach file" onclick={() => fileInput?.click()}>
					<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.4 11.05-9.19 9.2a5 5 0 0 1-7.07-7.08l9.2-9.19a3.33 3.33 0 0 1 4.71 4.71l-9.2 9.19a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48" /></svg>
				</button>
				<button class="hd" title="Share location" aria-label="Share location" onclick={onShareLocation}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
				</button>
				<button class="hd" title="Voice message" aria-label="Record voice message" onclick={startRec}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>
				</button>
				<button class="hd" class:on={pollOpen} title="Create poll" aria-label="Create poll" onclick={() => (pollOpen = !pollOpen)}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M12 20V4M20 20v-6" /></svg>
				</button>
				<button class="hd" class:on={stickerOpen} title="Sticker" aria-label="Sticker" onclick={() => (stickerOpen = !stickerOpen)}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5.5z" /><path d="M21 12.5 12.5 21v-6a2 2 0 0 1 2-2h6z" /></svg>
				</button>
				<input
					class="msg-input"
					bind:value={draft}
					onkeydown={onKey}
					oninput={notifyTyping}
					onblur={stopTyping}
					placeholder={editing ? "Edit message…" : `Message ${room.kind === "dm" ? room.name : `#${room.name}`}`}
				/>
				<button class="send" title="Send" aria-label="Send" onclick={submit}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>
				</button>
			{/if}
		</div>
	{:else}
		<div class="placeholder"><div class="owl">🦉</div><p>Pick a conversation to start hooting.</p></div>
	{/if}

	{#if pickerFor && pickerAnchor}
		<EmojiPicker
			anchor={pickerAnchor}
			onPick={(em) => { if (pickerFor) onReact(pickerFor, em); }}
			onClose={() => { pickerFor = null; pickerAnchor = null; }}
		/>
	{/if}
</section>

<style>
.chat {
	grid-area: chat;
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	background: var(--bg);
}
.bar {
	display: flex;
	align-items: center;
	gap: 11px;
	padding: 10px 14px;
	border-bottom: 1px solid var(--border);
}
.av {
	width: 34px;
	height: 34px;
	flex: none;
	border-radius: 10px;
	display: grid;
	place-items: center;
	font-weight: 700;
	color: #0b0c10;
	background: var(--c);
}
.av.dm {
	border-radius: 50%;
}
.meta {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	line-height: 1.25;
}
.meta strong {
	font-size: 15px;
}
.topic {
	font-size: 12px;
	color: var(--muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.actions {
	display: flex;
	gap: 6px;
}
.sicon {
	color: var(--muted);
	flex: none;
}
.sinput {
	flex: 1;
	background: none;
	border: none;
	outline: none;
	color: var(--text);
	font-size: 14px;
}
.scount {
	font-size: 12px;
	color: var(--muted);
	flex: none;
}
.hd {
	width: 32px;
	height: 32px;
	border-radius: 9px;
	border: none;
	background: transparent;
	color: var(--muted);
	cursor: pointer;
	display: grid;
	place-items: center;
	flex: none;
}
.hd:hover {
	background: var(--surface);
	color: var(--text);
}
.hd.on {
	background: color-mix(in srgb, var(--accent) 18%, transparent);
	color: var(--accent);
}
.stream {
	flex: 1;
	overflow-y: auto;
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.older {
	text-align: center;
	margin-bottom: 4px;
}
.older button {
	background: var(--surface);
	border: 1px solid var(--border);
	color: var(--text-dim);
	border-radius: 999px;
	padding: 5px 14px;
	font-size: 12.5px;
	cursor: pointer;
}
.older button:hover {
	border-color: var(--border-hi);
	color: var(--text);
}
.daysep {
	text-align: center;
	font-size: 11px;
	color: var(--muted);
	margin: 6px 0;
}
.daysep span {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 999px;
	padding: 2px 12px;
}
.noresults {
	text-align: center;
	color: var(--muted);
	font-size: 13px;
	margin-top: 20px;
}
.msg {
	position: relative;
	display: flex;
	gap: 10px;
	max-width: 80%;
}
.msg.me {
	align-self: flex-end;
	flex-direction: row-reverse;
}
.mav {
	width: 30px;
	height: 30px;
	flex: none;
	border-radius: 50%;
	display: grid;
	place-items: center;
	font-weight: 700;
	font-size: 13px;
	color: #0b0c10;
	background: var(--c);
}
.bubblewrap {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}
.msg.me .bubblewrap {
	align-items: flex-end;
}
.who {
	display: flex;
	gap: 7px;
	align-items: baseline;
	font-size: 12px;
}
.msg.me .who {
	flex-direction: row-reverse;
}
.sn {
	font-weight: 700;
}
.mt {
	color: var(--muted);
	font-size: 10.5px;
}
.reply {
	font-size: 11.5px;
	color: var(--muted);
	border-left: 2px solid var(--border-hi);
	padding: 1px 0 1px 7px;
	max-width: 320px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.audiobubble {
	display: flex;
	align-items: center;
	gap: 8px;
}
.audiobubble audio {
	height: 38px;
	max-width: 260px;
}
.adur {
	font-size: 11px;
	color: var(--muted);
}
.locbubble {
	display: flex;
	align-items: center;
	gap: 10px;
	border-radius: 12px;
	border: 1px solid var(--border);
	background: var(--surface);
	padding: 10px 12px;
	text-decoration: none;
	max-width: 280px;
}
.locpin {
	font-size: 22px;
}
.loctext {
	flex: 1;
	font-size: 13px;
	color: var(--text-dim);
	line-height: 1.35;
}
.loctext b {
	color: var(--text);
}
.locopen {
	font-size: 12px;
	font-weight: 700;
	color: var(--accent-2);
}
.recdot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: var(--danger);
	animation: pulse 1.2s ease-in-out infinite;
}
.rectime {
	flex: 1;
	font-size: 13.5px;
	color: var(--text);
	font-variant-numeric: tabular-nums;
}
@keyframes pulse {
	50% {
		opacity: 0.35;
	}
}
.pollbubble {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 4px 14px 14px 14px;
	padding: 10px 12px;
	min-width: 240px;
	max-width: 320px;
}
.pollq {
	font-weight: 700;
	font-size: 14px;
	color: var(--text);
	margin-bottom: 8px;
}
.pollopt {
	position: relative;
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 7px 10px;
	margin-bottom: 5px;
	border: 1px solid var(--border);
	border-radius: 9px;
	background: var(--panel);
	color: var(--text-dim);
	cursor: pointer;
	overflow: hidden;
	text-align: left;
}
.pollopt:hover {
	border-color: var(--accent);
}
.pollopt.mine {
	border-color: color-mix(in srgb, var(--accent) 60%, transparent);
}
.pollbar {
	position: absolute;
	inset: 0 auto 0 0;
	background: color-mix(in srgb, var(--accent) 18%, transparent);
	transition: width 0.3s;
}
.polltext {
	position: relative;
	flex: 1;
	font-size: 13px;
}
.pollcount {
	position: relative;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	color: var(--muted);
}
.pollmeta {
	font-size: 11.5px;
	color: var(--muted);
	margin-top: 2px;
}
.pollcreate {
	margin: 0 14px 8px;
	padding: 12px;
	border: 1px solid var(--border);
	border-radius: 12px;
	background: var(--surface);
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.stickerpanel {
	margin: 0 14px 8px;
	padding: 10px;
	border: 1px solid var(--border);
	border-radius: 12px;
	background: var(--surface);
	max-height: 200px;
	overflow-y: auto;
}
.sgrid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
	gap: 6px;
}
.sitem {
	border: none;
	background: transparent;
	padding: 4px;
	border-radius: 8px;
	cursor: pointer;
	aspect-ratio: 1;
}
.sitem:hover {
	background: var(--panel-2);
}
.sitem img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}
.sempty {
	margin: 0;
	font-size: 13px;
	color: var(--muted);
	text-align: center;
	padding: 8px;
}
.pollinput {
	height: 34px;
	padding: 0 11px;
	border-radius: 9px;
	border: 1px solid var(--border);
	background: var(--panel);
	color: var(--text);
	outline: none;
	font-size: 13.5px;
}
.pollinput:focus {
	border-color: var(--accent);
}
.pollcreate-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}
.pollcreate-actions .spacer {
	flex: 1;
}
.pollcreate-actions button {
	padding: 6px 12px;
	border-radius: 8px;
	border: 1px solid var(--border);
	background: var(--panel);
	color: var(--text-dim);
	font-size: 12.5px;
	font-weight: 600;
	cursor: pointer;
}
.pollcreate-actions .primary {
	background: var(--accent);
	color: #0b0c10;
	border-color: transparent;
}
.bubble {
	background: var(--surface);
	border: 1px solid var(--border);
	padding: 8px 12px;
	border-radius: 4px 14px 14px 14px;
	font-size: 14px;
	color: var(--text-dim);
	overflow-wrap: anywhere;
}
.bubble :global(code) {
	background: var(--panel-2);
	border-radius: 4px;
	padding: 1px 5px;
	font-size: 12.5px;
}
.bubble :global(a) {
	color: var(--accent-2);
}
.msg.me .bubble {
	background: color-mix(in srgb, var(--accent) 22%, var(--surface));
	border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	color: var(--text);
	border-radius: 14px 4px 14px 14px;
}
.imgbubble {
	display: block;
	max-width: 320px;
	border-radius: 12px;
	overflow: hidden;
	border: 1px solid var(--border);
}
.imgbubble img {
	display: block;
	width: 100%;
	height: auto;
}
.filebubble {
	display: flex;
	align-items: center;
	gap: 9px;
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 12px;
	padding: 10px 13px;
	color: var(--text);
	text-decoration: none;
	max-width: 280px;
}
.filebubble svg {
	color: var(--accent);
	flex: none;
}
.filebubble span {
	font-size: 13px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.reacts {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 2px;
}
.threadbtn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	margin-top: 4px;
	padding: 3px 9px;
	border: 1px solid var(--border);
	border-radius: 999px;
	background: var(--surface);
	color: var(--accent-2);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
}
.threadbtn:hover {
	border-color: var(--accent);
}
.readby {
	display: flex;
	gap: -4px;
	margin-top: 3px;
	justify-content: flex-end;
}
.msg:not(.me) .readby {
	justify-content: flex-start;
}
.rr {
	width: 15px;
	height: 15px;
	border-radius: 50%;
	display: grid;
	place-items: center;
	font-size: 8px;
	font-weight: 700;
	color: #0b0c10;
	background: var(--c);
	border: 1.5px solid var(--bg);
	margin-left: -4px;
}
.react {
	border: 1px solid var(--border);
	background: var(--surface);
	color: var(--text-dim);
	border-radius: 999px;
	padding: 1px 8px;
	font-size: 12px;
	cursor: pointer;
	font-variant-numeric: tabular-nums;
}
.react:hover {
	border-color: var(--border-hi);
}
.react.mine {
	background: color-mix(in srgb, var(--accent) 20%, transparent);
	border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	color: var(--text);
}
.menu {
	position: absolute;
	top: -12px;
	right: 36px;
	display: none;
	gap: 1px;
	background: var(--panel-2);
	border: 1px solid var(--border);
	border-radius: 9px;
	padding: 2px;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
	z-index: 3;
}
.msg.me .menu {
	right: auto;
	left: 36px;
}
.msg:hover .menu {
	display: flex;
}
.more {
	position: relative;
	display: inline-flex;
}
.menu button {
	min-width: 26px;
	height: 26px;
	border: none;
	background: transparent;
	color: var(--muted);
	border-radius: 6px;
	cursor: pointer;
	font-size: 14px;
	display: grid;
	place-items: center;
}
.menu button:hover {
	background: var(--surface);
	color: var(--text);
}
.menu .del:hover {
	color: var(--danger);
}
.typing {
	padding: 2px 18px;
	font-size: 12px;
	color: var(--muted);
	font-style: italic;
}
.callbanner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 0 14px 8px;
	padding: 9px 14px;
	border-radius: 10px;
	background: color-mix(in srgb, var(--good, #3fb950) 16%, var(--surface));
	border: 1px solid color-mix(in srgb, var(--good, #3fb950) 45%, transparent);
	font-size: 13px;
	font-weight: 600;
}
.callbanner button {
	padding: 5px 16px;
	border-radius: 9px;
	border: none;
	background: var(--good, #3fb950);
	color: #0b0c10;
	font-weight: 800;
	font-size: 13px;
	cursor: pointer;
}
.banner {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 7px 16px;
	border-top: 1px solid var(--border);
	font-size: 12.5px;
	color: var(--text-dim);
}
.banner b {
	color: var(--text);
}
.banner button {
	margin-left: auto;
	background: none;
	border: none;
	color: var(--accent-2);
	cursor: pointer;
	font-size: 12.5px;
}
.composer {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px 14px;
	border-top: 1px solid var(--border);
}
.hidden {
	display: none;
}
.msg-input {
	flex: 1;
	height: 42px;
	padding: 0 14px;
	border-radius: 12px;
	background: var(--surface);
	border: 1px solid var(--border);
	color: var(--text);
	outline: none;
	font-size: 14px;
}
.msg-input:focus {
	border-color: var(--accent);
}
.send {
	width: 42px;
	height: 42px;
	flex: none;
	border-radius: 12px;
	border: none;
	background: var(--accent);
	color: #0b0c10;
	cursor: pointer;
	display: grid;
	place-items: center;
}
.send:hover {
	filter: brightness(1.08);
}
.placeholder {
	margin: auto;
	text-align: center;
	color: var(--muted);
}
.owl {
	font-size: 56px;
	opacity: 0.5;
	margin-bottom: 10px;
}
</style>
