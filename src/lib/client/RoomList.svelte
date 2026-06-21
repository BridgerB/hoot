<script lang="ts">
import { FILTERS, type Filter, type Room } from "./mock";

let {
	title,
	rooms,
	filter,
	onFilter,
	query,
	onQuery,
	searchFocus,
	selected,
	onSelect,
	onNewRoom,
}: {
	title: string;
	rooms: Room[];
	filter: Filter;
	onFilter: (f: Filter) => void;
	query: string;
	onQuery: (q: string) => void;
	searchFocus: number;
	selected: string;
	onSelect: (id: string) => void;
	onNewRoom: () => void;
} = $props();

let searchEl = $state<HTMLInputElement>();
$effect(() => {
	if (searchFocus > 0) searchEl?.focus();
});
</script>

<section class="list" aria-label="Conversations">
	<header class="head">
		<h1>{title}</h1>
		<button class="icon" title="New conversation" aria-label="New conversation" onclick={onNewRoom}>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	</header>

	<div class="search">
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
		</svg>
		<input
			bind:this={searchEl}
			placeholder="Search"
			value={query}
			oninput={(e) => onQuery(e.currentTarget.value)}
		/>
		<kbd>⌘K</kbd>
	</div>

	<div class="chips">
		{#each FILTERS as f (f)}
			<button class="chip" class:on={filter === f} onclick={() => onFilter(f)}>{f}</button>
		{/each}
	</div>

	<div class="rows">
		{#each rooms as r (r.id)}
			<button class="row" class:on={selected === r.id} onclick={() => onSelect(r.id)}>
				<span class="av" class:dm={r.kind === "dm"} style="--c:{r.color}">{r.glyph}</span>
				<span class="mid">
					<span class="top">
						<span class="name">{r.name}</span>
						<span class="ts">{r.ts}</span>
					</span>
					<span class="bot">
						<span class="last">{r.lastSender === "you" ? "You: " : ""}{r.last}</span>
						{#if r.muted}
							<svg class="mute" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
						{:else if r.unread > 0}
							<span class="badge">{r.unread}</span>
						{/if}
					</span>
				</span>
			</button>
		{/each}
		{#if rooms.length === 0}
			<p class="empty">No conversations match.</p>
		{/if}
	</div>
</section>

<style>
.list {
	grid-area: list;
	display: flex;
	flex-direction: column;
	min-height: 0;
	background: var(--panel);
	border-right: 1px solid var(--border);
}
.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 14px 8px;
}
.head h1 {
	margin: 0;
	font-size: 17px;
	font-weight: 800;
	letter-spacing: -0.3px;
}
.icon {
	width: 30px;
	height: 30px;
	border-radius: 9px;
	border: 1px solid var(--border);
	background: var(--surface);
	color: var(--text-dim);
	cursor: pointer;
	display: grid;
	place-items: center;
}
.icon:hover {
	color: var(--text);
	border-color: var(--border-hi);
}
.search {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 2px 12px 10px;
	padding: 0 10px;
	height: 36px;
	border-radius: 10px;
	background: var(--surface);
	border: 1px solid var(--border);
	color: var(--muted);
}
.search:focus-within {
	border-color: var(--accent);
}
.search input {
	flex: 1;
	background: none;
	border: none;
	outline: none;
	color: var(--text);
	font-size: 13.5px;
}
.search kbd {
	font: 11px ui-monospace, monospace;
	color: var(--muted);
	background: var(--panel-2);
	border: 1px solid var(--border);
	border-radius: 6px;
	padding: 1px 5px;
}
.chips {
	display: flex;
	gap: 7px;
	padding: 0 12px 10px;
	flex-wrap: wrap;
}
.chip {
	border: 1px solid var(--border);
	background: var(--surface);
	color: var(--muted);
	border-radius: 999px;
	padding: 4px 11px;
	font-size: 12.5px;
	font-weight: 600;
	cursor: pointer;
}
.chip:hover {
	color: var(--text-dim);
}
.chip.on {
	background: color-mix(in srgb, var(--accent) 18%, transparent);
	border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	color: var(--text);
}
.rows {
	flex: 1;
	overflow-y: auto;
	padding: 4px 8px 12px;
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.row {
	display: flex;
	gap: 10px;
	align-items: center;
	padding: 8px;
	border-radius: 10px;
	border: none;
	background: none;
	color: inherit;
	cursor: pointer;
	text-align: left;
	width: 100%;
}
.row:hover {
	background: var(--surface);
}
.row.on {
	background: var(--surface-2);
}
.av {
	width: 40px;
	height: 40px;
	flex: none;
	border-radius: 12px;
	display: grid;
	place-items: center;
	font-weight: 700;
	font-size: 16px;
	color: #0b0c10;
	background: var(--c);
}
.av.dm {
	border-radius: 50%;
}
.mid {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.top {
	display: flex;
	align-items: baseline;
	gap: 8px;
}
.name {
	flex: 1;
	font-weight: 600;
	font-size: 14px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ts {
	font-size: 11px;
	color: var(--muted);
	flex: none;
}
.bot {
	display: flex;
	align-items: center;
	gap: 8px;
}
.last {
	flex: 1;
	font-size: 12.5px;
	color: var(--muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.badge {
	flex: none;
	min-width: 18px;
	height: 18px;
	padding: 0 5px;
	border-radius: 9px;
	background: var(--accent);
	color: #0b0c10;
	font-size: 11px;
	font-weight: 800;
	display: grid;
	place-items: center;
}
.mute {
	color: var(--muted);
	flex: none;
}
.empty {
	color: var(--muted);
	text-align: center;
	font-size: 13px;
	margin-top: 24px;
}
</style>
