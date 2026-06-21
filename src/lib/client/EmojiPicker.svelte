<script lang="ts">
let {
	onPick,
	onClose,
}: { onPick: (emoji: string) => void; onClose: () => void } = $props();

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
</script>

<div class="pop" role="dialog" aria-label="Emoji picker">
	<div class="grid">
		{#each GROUPS as g (g.name)}
			<div class="cap">{g.name}</div>
			<div class="row">
				{#each g.emojis as e (e)}
					<button class="e" onclick={() => { onPick(e); onClose(); }} title={e}>{e}</button>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
.pop {
	position: absolute;
	z-index: 30;
	bottom: calc(100% + 6px);
	right: 0;
	width: 248px;
	max-height: 240px;
	overflow-y: auto;
	background: var(--panel);
	border: 1px solid var(--border);
	border-radius: 12px;
	box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
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
