<script lang="ts">
import { callController as c } from "$lib/call.svelte";
import CallFeedVideo from "./CallFeedVideo.svelte";

const localFeed = $derived(c.feeds.find((f) => f.isLocal()));
const remoteFeed = $derived(c.feeds.find((f) => !f.isLocal()));
const peer = $derived(
	c.call?.getOpponentMember()?.name ??
		c.incoming?.getOpponentMember()?.name ??
		"",
);
const label = $derived(
	c.state === "connected"
		? "Connected"
		: c.state === "ringing"
			? "Ringing…"
			: c.state
				? "Calling…"
				: "",
);
</script>

{#if c.incoming}
	<div class="callwrap">
		<div class="card">
			<div class="big">📞</div>
			<p class="who">{peer || "Incoming call"}</p>
			<p class="sub">is calling…</p>
			<div class="row">
				<button class="rbtn reject" onclick={() => c.reject()}>Decline</button>
				<button class="rbtn ans" onclick={() => c.answer(false)}>Answer</button>
				<button class="rbtn ans vid" onclick={() => c.answer(true)}>Video</button>
			</div>
		</div>
	</div>
{:else if c.call}
	<div class="callwrap">
		<div class="stage">
			{#if remoteFeed}
				<CallFeedVideo feed={remoteFeed} />
			{:else}
				<div class="placeholder"><div class="big">📞</div><p>{peer}</p><p class="sub">{label}</p></div>
			{/if}
			{#if localFeed}
				<div class="pip"><CallFeedVideo feed={localFeed} muted /></div>
			{/if}
			<div class="controls">
				<button class="cbtn" class:off={c.micMuted} title="Mute" aria-label="Mute" onclick={() => c.toggleMic()}>
					{c.micMuted ? "🔇" : "🎙️"}
				</button>
				<button class="cbtn" class:off={c.vidMuted} title="Camera" aria-label="Camera" onclick={() => c.toggleVid()}>
					{c.vidMuted ? "📷" : "🎥"}
				</button>
				<button class="cbtn hang" title="Hang up" aria-label="Hang up" onclick={() => c.hangup()}>📴</button>
			</div>
		</div>
	</div>
{/if}

<style>
.callwrap {
	position: fixed;
	inset: 0;
	z-index: 80;
	background: rgba(0, 0, 0, 0.7);
	display: grid;
	place-items: center;
	padding: 24px;
}
.card {
	background: var(--panel);
	border: 1px solid var(--border);
	border-radius: 18px;
	padding: 28px 32px;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	min-width: 280px;
}
.big {
	font-size: 44px;
}
.who {
	margin: 6px 0 0;
	font-size: 18px;
	font-weight: 700;
}
.sub {
	margin: 0;
	color: var(--muted);
	font-size: 13px;
}
.row {
	display: flex;
	gap: 10px;
	margin-top: 16px;
}
.rbtn {
	padding: 10px 18px;
	border-radius: 11px;
	border: none;
	font-weight: 700;
	font-size: 14px;
	cursor: pointer;
}
.reject {
	background: var(--danger);
	color: #fff;
}
.ans {
	background: var(--good, #3fb950);
	color: #0b0c10;
}
.ans.vid {
	background: var(--accent);
}
.stage {
	position: relative;
	width: min(880px, 92vw);
	height: min(560px, 78vh);
	background: #000;
	border-radius: 16px;
	overflow: hidden;
}
.placeholder {
	position: absolute;
	inset: 0;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 4px;
	color: #fff;
}
.pip {
	position: absolute;
	right: 14px;
	bottom: 84px;
	width: 150px;
	height: 100px;
	border-radius: 10px;
	overflow: hidden;
	border: 2px solid rgba(255, 255, 255, 0.5);
}
.controls {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 16px;
	display: flex;
	justify-content: center;
	gap: 14px;
}
.cbtn {
	width: 50px;
	height: 50px;
	border-radius: 50%;
	border: none;
	background: rgba(255, 255, 255, 0.16);
	font-size: 20px;
	cursor: pointer;
}
.cbtn.off {
	background: rgba(255, 255, 255, 0.35);
}
.cbtn.hang {
	background: var(--danger);
}
</style>
