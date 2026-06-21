<script lang="ts">
import { goto } from "$app/navigation";
import { login } from "$lib/matrix.svelte";

let baseUrl = $state("http://129.153.101.92:8008");
let user = $state("");
let pass = $state("");
let busy = $state(false);
let error = $state("");

async function submit(e: SubmitEvent) {
	e.preventDefault();
	if (!user.trim() || !pass || busy) return;
	busy = true;
	error = "";
	try {
		await login(baseUrl.trim(), user.trim(), pass);
		await goto(`/${location.search}`);
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		busy = false;
	}
}
</script>

<svelte:head><title>hoot · sign in</title></svelte:head>

<main class="wrap">
	<form class="card" onsubmit={submit}>
		<div class="brand"><span class="owl">🦉</span><h1>hoot</h1></div>
		<p class="sub">Sign in to your Matrix account</p>

		<label><span>Homeserver</span><input bind:value={baseUrl} autocomplete="off" /></label>
		<label><span>Username</span><input bind:value={user} placeholder="alice_hoot" autocomplete="username" /></label>
		<label><span>Password</span><input type="password" bind:value={pass} placeholder="••••••••" autocomplete="current-password" /></label>

		{#if error}<p class="error">{error}</p>{/if}

		<button class="go" type="submit" disabled={busy || !user.trim() || !pass}>
			{busy ? "Signing in…" : "Sign in"}
		</button>
	</form>
</main>

<style>
.wrap {
	min-height: 100dvh;
	display: grid;
	place-items: center;
	padding: 24px;
}
.card {
	width: 100%;
	max-width: 380px;
	background: var(--panel);
	border: 1px solid var(--border);
	border-radius: 18px;
	padding: 30px 26px 24px;
	display: flex;
	flex-direction: column;
	gap: 14px;
	box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}
.brand {
	display: flex;
	align-items: center;
	gap: 10px;
}
.owl {
	font-size: 30px;
}
.brand h1 {
	margin: 0;
	font-size: 26px;
	font-weight: 800;
	letter-spacing: -0.5px;
}
.sub {
	margin: -6px 0 6px;
	color: var(--muted);
	font-size: 13.5px;
}
label {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
label span {
	font-size: 12px;
	color: var(--muted);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}
input {
	height: 42px;
	padding: 0 13px;
	border-radius: 11px;
	background: var(--surface);
	border: 1px solid var(--border);
	color: var(--text);
	outline: none;
	font-size: 14px;
}
input:focus {
	border-color: var(--accent);
}
.error {
	margin: 0;
	color: var(--danger);
	font-size: 13px;
}
.go {
	height: 44px;
	margin-top: 4px;
	border: none;
	border-radius: 11px;
	background: var(--accent);
	color: #0b0c10;
	font-weight: 800;
	font-size: 14.5px;
	cursor: pointer;
}
.go:disabled {
	opacity: 0.5;
	cursor: default;
}
</style>
