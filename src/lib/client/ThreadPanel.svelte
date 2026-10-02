<script lang="ts">
import { renderMarkdown } from "./md";
import type { Message } from "./mock";

let {
	messages,
	onSend,
	onClose,
}: {
	messages: Message[];
	onSend: (content: Record<string, unknown>) => void;
	onClose: () => void;
} = $props();

let draft = $state("");
let streamEl = $state<HTMLDivElement>();

function submit() {
	const text = draft.trim();
	if (!text) return;
	onSend({ msgtype: "m.text", body: text });
	draft = "";
}
function onKey(e: KeyboardEvent) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		submit();
	} else if (e.key === "Escape") {
		onClose();
	}
}

let lastLen = 0;
$effect(() => {
	if (messages.length !== lastLen) {
		lastLen = messages.length;
		queueMicrotask(() => {
			if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
		});
	}
});
</script>

<aside class="thread" aria-label="Thread">
	<header class="head">
		<span>🧵 Thread</span>
		<button class="x" title="Close" aria-label="Close thread" onclick={onClose}>
			<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
		</button>
	</header>

	<div class="tstream" bind:this={streamEl}>
		{#each messages as m, i (m.id)}
			<div class="tmsg" class:root={i === 0}>
				<span class="tav" style="--c:{m.color}">{m.sender[0]?.toUpperCase() ?? "?"}</span>
				<div class="tbody">
					<div class="twho"><b style="color:{m.color}">{m.sender}</b><span class="tt">{m.ts}{m.edited ? " · edited" : ""}</span></div>
					{#if m.kind === "image" && m.url}
						<a href={m.url} target="_blank" rel="noreferrer"><img class="timg" src={m.url} alt={m.name ?? "image"} /></a>
					{:else}
						<!-- eslint-disable-next-line -->
						<div class="tbubble">{@html renderMarkdown(m.body)}</div>
					{/if}
				</div>
			</div>
			{#if i === 0}
				<div class="tdiv">{messages.length - 1} {messages.length - 1 === 1 ? "reply" : "replies"}</div>
			{/if}
		{/each}
	</div>

	<div class="tcomposer">
		<input bind:value={draft} onkeydown={onKey} placeholder="Reply in thread…" />
		<button class="tsend" title="Send" aria-label="Send" onclick={submit}>
			<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>
		</button>
	</div>
</aside>

<style>
.thread {
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
.tstream {
	flex: 1;
	overflow-y: auto;
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.tmsg {
	display: flex;
	gap: 8px;
}
.tmsg.root {
	padding-bottom: 6px;
}
.tav {
	width: 28px;
	height: 28px;
	flex: none;
	border-radius: 50%;
	display: grid;
	place-items: center;
	font-weight: 700;
	font-size: 11px;
	color: #0b0c10;
	background: var(--c);
}
.tbody {
	min-width: 0;
}
.twho {
	display: flex;
	align-items: baseline;
	gap: 6px;
	font-size: 12.5px;
}
.tt {
	font-size: 10.5px;
	color: var(--muted);
}
.tbubble {
	font-size: 13.5px;
	color: var(--text-dim);
	overflow-wrap: anywhere;
	margin-top: 2px;
}
.tbubble :global(a) {
	color: var(--accent-2);
}
.timg {
	max-width: 100%;
	border-radius: 10px;
	margin-top: 4px;
}
.tdiv {
	font-size: 11px;
	color: var(--muted);
	border-bottom: 1px solid var(--border);
	padding-bottom: 6px;
}
.tcomposer {
	display: flex;
	gap: 8px;
	padding: 10px;
	border-top: 1px solid var(--border);
}
.tcomposer input {
	flex: 1;
	height: 38px;
	padding: 0 12px;
	border-radius: 10px;
	border: 1px solid var(--border);
	background: var(--surface);
	color: var(--text);
	outline: none;
	font-size: 14px;
}
.tcomposer input:focus {
	border-color: var(--accent);
}
.tsend {
	width: 38px;
	border-radius: 10px;
	border: none;
	background: var(--accent);
	color: #0b0c10;
	cursor: pointer;
	display: grid;
	place-items: center;
}
</style>
