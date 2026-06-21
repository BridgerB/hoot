<script lang="ts">
// SPA shell. The server data layer has been removed — the next step wires
// matrix-js-sdk in the browser to drive the UI components in $lib/client.
</script>

<svelte:head><title>hoot</title></svelte:head>

<main>
	<div class="owl">🦉</div>
	<h1>hoot</h1>
	<p>Static SPA shell — migrating to the in-browser <code>matrix-js-sdk</code> client.</p>
	<p class="dim">UI components live in <code>src/lib/client/</code>, ready to be wired to the SDK.</p>
</main>

<style>
main {
	min-height: 100dvh;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 6px;
	text-align: center;
	padding: 24px;
}
.owl {
	font-size: 56px;
}
h1 {
	margin: 4px 0;
	font-size: 28px;
	font-weight: 800;
	letter-spacing: -0.5px;
}
p {
	margin: 0;
	color: var(--text-dim);
	max-width: 460px;
}
.dim {
	color: var(--muted);
	font-size: 13px;
}
code {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 5px;
	padding: 1px 6px;
	font-size: 0.9em;
}
</style>
