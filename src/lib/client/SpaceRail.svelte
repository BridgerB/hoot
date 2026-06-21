<script lang="ts">
import type { Space } from "./mock";

let {
	spaces,
	me,
	active,
	onSelect,
	onSettings,
	onCreateSpace,
}: {
	spaces: Space[];
	me: { name: string; id: string; color: string; glyph: string };
	active: string;
	onSelect: (id: string) => void;
	onSettings: () => void;
	onCreateSpace: () => void;
} = $props();
</script>

<nav class="rail" aria-label="Spaces">
	<button
		class="pip home"
		class:on={active === "home"}
		onclick={() => onSelect("home")}
		title="Home — all chats"
		aria-label="Home"
	>
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
		</svg>
	</button>

	<div class="sep"></div>

	{#each spaces as s (s.id)}
		<button
			class="pip"
			class:on={active === s.id}
			style="--c:{s.color}"
			onclick={() => onSelect(s.id)}
			title={s.name}
			aria-label={s.name}
		>
			<span class="glyph">{s.glyph}</span>
		</button>
	{/each}

	<button class="pip add" title="Create space" aria-label="Create space" onclick={onCreateSpace}>+</button>

	<div class="grow"></div>

	<button class="pip ghost" title="Settings" aria-label="Settings" onclick={onSettings}>
		<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</svg>
	</button>
	<button class="pip avatar" title={me.id} aria-label="You" style="--c:{me.color}">
		<span class="glyph">{me.glyph}</span>
		<i class="dot"></i>
	</button>
</nav>

<style>
.rail {
	grid-area: rail;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 10px 0 12px;
	background: var(--rail);
	border-right: 1px solid var(--border);
	overflow-y: auto;
}
.sep {
	width: 26px;
	height: 1px;
	background: var(--border);
	margin: 2px 0;
}
.grow {
	flex: 1;
}
.pip {
	position: relative;
	width: 44px;
	height: 44px;
	flex: none;
	border: none;
	border-radius: 14px;
	background: var(--surface);
	color: var(--text-dim);
	cursor: pointer;
	display: grid;
	place-items: center;
	font-size: 17px;
	transition: border-radius 0.16s, background 0.16s, color 0.16s, transform 0.16s;
}
.pip:hover {
	border-radius: 12px;
	background: var(--surface-2);
	color: var(--text);
	transform: translateY(-1px);
}
.pip.on {
	border-radius: 13px;
	box-shadow: inset 0 0 0 2px var(--accent);
	color: var(--text);
}
/* active indicator bar on the left */
.pip.on::before {
	content: "";
	position: absolute;
	left: -10px;
	top: 50%;
	transform: translateY(-50%);
	width: 4px;
	height: 22px;
	border-radius: 0 4px 4px 0;
	background: var(--accent);
}
.glyph {
	font-weight: 700;
	color: var(--c, var(--text));
}
.pip.on .glyph,
.pip.avatar .glyph {
	color: #0b0c10;
}
.pip.on,
.pip.avatar {
	background: var(--c, var(--accent));
}
.home {
	color: var(--accent-2);
}
.add {
	color: var(--good);
	font-size: 22px;
	background: transparent;
	border: 1px dashed var(--border-hi);
}
.add:hover {
	background: color-mix(in srgb, var(--good) 14%, transparent);
}
.ghost {
	background: transparent;
}
.avatar {
	margin-top: 2px;
}
.dot {
	position: absolute;
	right: 1px;
	bottom: 1px;
	width: 11px;
	height: 11px;
	border-radius: 50%;
	background: var(--good);
	border: 2px solid var(--rail);
}
</style>
