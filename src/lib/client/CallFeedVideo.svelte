<script lang="ts">
import { CallFeedEvent } from "matrix-js-sdk";
import type { CallFeed } from "matrix-js-sdk/lib/webrtc/callFeed";

let { feed, muted = false }: { feed: CallFeed; muted?: boolean } = $props();

function bind(el: HTMLVideoElement) {
	const apply = () => {
		el.srcObject = feed.stream;
		el.play().catch(() => {});
	};
	apply();
	feed.on(CallFeedEvent.NewStream, apply);
	return () => feed.off(CallFeedEvent.NewStream, apply);
}
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video {@attach bind} autoplay playsinline {muted} class="feed"></video>

<style>
.feed {
	width: 100%;
	height: 100%;
	object-fit: cover;
	background: #000;
}
</style>
