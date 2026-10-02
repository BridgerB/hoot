<script lang="ts">
let {
	anchor,
	onPick,
	onClose,
}: { anchor: DOMRect; onPick: (emoji: string) => void; onClose: () => void } =
	$props();

// curated, no external data — grouped for quick scanning
const GROUPS: { name: string; emojis: string[] }[] = [
	{
		name: "Smileys",
		emojis:
			"😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 😘 😋 😛 🤪 🤔 🤨 😐 😏 😴 😌 😎 🥳 🥺 😢 😭 😤 😠 😱 🤯 😬 🙄".split(
				" ",
			),
	},
	{
		name: "Gestures",
		emojis: "👍 👎 👌 🤌 ✌️ 🤞 🤟 🤙 👋 🙏 👏 🙌 💪 🫶 🤝 👀 🧠 🔥 ✨ 💯".split(
			" ",
		),
	},
	{
		name: "Hearts",
		emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖".split(" "),
	},
	{
		name: "Animals",
		emojis: "🐶 🐱 🦊 🐻 🐼 🐨 🐯 🦁 🐸 🐵 🐔 🦉 🦄 🐝 🦋 🐢 🐙 🦀".split(" "),
	},
	{
		name: "Food",
		emojis: "🍎 🍕 🍔 🌮 🍣 🍜 🍪 🍩 🎂 🍿 ☕ 🍺 🍷 🥂 🧉".split(" "),
	},
	{
		name: "Fun",
		emojis: "🎉 🎊 🚀 ⭐ 🌈 ⚡ 💥 🎈 🏆 🎮 🎵 💡 📌 ✅ ❌ ❓ ❗".split(" "),
	},
];

// position fixed relative to the trigger, flipping below if there's no room above
function place(el: HTMLDivElement) {
	const w = 252;
	const h = Math.min(260, el.scrollHeight || 260);
	let top = anchor.top - h - 6;
	if (top < 10) top = anchor.bottom + 6;
	let left = anchor.right - w;
	left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
	el.style.top = `${top}px`;
	el.style.left = `${left}px`;
}
</script>

<button class="backdrop" aria-label="Close emoji picker" onclick={onClose}></button>
<div class="pop" role="dialog" aria-label="Emoji picker" {@attach place}>
	{#each GROUPS as g (g.name)}
		<div class="cap">{g.name}</div>
		<div class="row">
			{#each g.emojis as e (e)}
				<button class="e" title={e} onclick={() => { onPick(e); onClose(); }}>{e}</button>
			{/each}
		</div>
	{/each}
</div>

<style>
.backdrop {
	position: fixed;
	inset: 0;
	z-index: 60;
	border: none;
	background: transparent;
	cursor: default;
}
.pop {
	position: fixed;
	z-index: 61;
	width: 252px;
	max-height: 260px;
	overflow-y: auto;
	background: var(--panel);
	border: 1px solid var(--border);
	border-radius: 12px;
	box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
	padding: 8px;
}
.cap {
	font-size: 10px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--muted);
	margin: 6px 4px 3px;
}
.row {
	display: grid;
	grid-template-columns: repeat(8, 1fr);
	gap: 1px;
}
.e {
	border: none;
	background: transparent;
	font-size: 18px;
	line-height: 1;
	padding: 4px 0;
	border-radius: 7px;
	cursor: pointer;
}
.e:hover {
	background: var(--surface);
}
</style>
