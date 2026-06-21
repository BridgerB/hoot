<script lang="ts">
import { untrack } from "svelte";

let {
	me,
	server,
	roomCount,
	spaceCount,
	encryption,
	notifPermission,
	onClose,
	onSaveName,
	onSetupEncryption,
	onUnlockEncryption,
	onEnableNotifications,
	onLogout,
}: {
	me: { name: string; id: string; color: string; glyph: string };
	server: string;
	roomCount: number;
	spaceCount: number;
	encryption: {
		crypto: boolean;
		crossSigning: boolean;
		secretStorage: boolean;
		backup: string | null;
	};
	notifPermission: "default" | "granted" | "denied" | "unsupported";
	onClose: () => void;
	onSaveName: (name: string) => Promise<void> | void;
	onSetupEncryption: (password: string) => Promise<string>;
	onUnlockEncryption: (recoveryKey: string) => Promise<void>;
	onEnableNotifications: () => Promise<string>;
	onLogout: () => void;
} = $props();

let notif = $state(untrack(() => notifPermission));
async function enableNotif() {
	notif = (await onEnableNotifications()) as typeof notif;
}

let name = $state(untrack(() => me.name));
let saving = $state(false);

async function save() {
	if (!name.trim() || name.trim() === me.name) return;
	saving = true;
	await onSaveName(name.trim());
	saving = false;
}

const encReady = $derived(encryption.crossSigning && encryption.secretStorage);
let pw = $state("");
let rkInput = $state("");
let recoveryKeyShown = $state("");
let unlocking = $state(false);
let encBusy = $state(false);
let encError = $state("");

async function setupEnc() {
	if (!pw || encBusy) return;
	encBusy = true;
	encError = "";
	try {
		recoveryKeyShown = await onSetupEncryption(pw);
		pw = "";
	} catch (e) {
		encError = e instanceof Error ? e.message : String(e);
	}
	encBusy = false;
}

async function unlockEnc() {
	if (!rkInput.trim() || encBusy) return;
	encBusy = true;
	encError = "";
	try {
		await onUnlockEncryption(rkInput.trim());
		rkInput = "";
		unlocking = false;
	} catch (e) {
		encError = e instanceof Error ? e.message : String(e);
	}
	encBusy = false;
}
</script>

<div
	class="backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="modal" role="dialog" aria-label="Settings">
		<header>
			<h2>Settings</h2>
			<button class="x" title="Close" aria-label="Close" onclick={onClose}>
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
			</button>
		</header>

		<div class="body">
			<div class="who">
				<span class="av" style="--c:{me.color}">{me.glyph}</span>
				<div>
					<strong>{me.name}</strong>
					<div class="mxid">{me.id}</div>
				</div>
			</div>

			<label class="field">
				<span>Display name</span>
				<div class="row">
					<input bind:value={name} placeholder="Your name" />
					<button class="save" disabled={saving || !name.trim() || name.trim() === me.name} onclick={save}>
						{saving ? "Saving…" : "Save"}
					</button>
				</div>
			</label>

			<section class="enc">
				<div class="enc-head">
					<span class="cap">Encryption</span>
					<span class="badge" class:ok={encReady} class:warn={!encReady}>
						{encReady ? "🔒 On" : "⚠ Not set up"}
					</span>
				</div>

				{#if recoveryKeyShown}
					<div class="recovery">
						<p>Save this recovery key somewhere safe — it's the only way to restore your encrypted messages on a new device.</p>
						<code class="rk">{recoveryKeyShown}</code>
						<div class="rkrow">
							<button class="mini" onclick={() => navigator.clipboard?.writeText(recoveryKeyShown)}>Copy</button>
							<button class="mini" onclick={() => (recoveryKeyShown = "")}>Done</button>
						</div>
					</div>
				{:else if encReady}
					<ul class="flags">
						<li>{encryption.crossSigning ? "✅" : "—"} Cross-signing</li>
						<li>{encryption.secretStorage ? "✅" : "—"} Secure key storage</li>
						<li>{encryption.backup ? `✅ Key backup (v${encryption.backup})` : "— Key backup"}</li>
					</ul>
				{:else}
					<p class="enc-hint">Set up encryption to enable cross-signing, secure key backup, and a recovery key.</p>
					{#if !unlocking}
						<div class="row">
							<input type="password" bind:value={pw} placeholder="Account password" />
							<button class="save" disabled={encBusy || !pw} onclick={setupEnc}>{encBusy ? "Setting up…" : "Set up"}</button>
						</div>
						<button class="link" onclick={() => (unlocking = true)}>I already have a recovery key</button>
					{:else}
						<div class="row">
							<input bind:value={rkInput} placeholder="Recovery key (EsT… )" />
							<button class="save" disabled={encBusy || !rkInput.trim()} onclick={unlockEnc}>{encBusy ? "Unlocking…" : "Unlock"}</button>
						</div>
						<button class="link" onclick={() => (unlocking = false)}>Back</button>
					{/if}
				{/if}
				{#if encError}<p class="err">{encError}</p>{/if}
			</section>

			<div class="notif">
				<span class="cap">Desktop notifications</span>
				{#if notif === "granted"}
					<span class="badge ok">✅ On</span>
				{:else if notif === "denied"}
					<span class="badge warn">Blocked in browser</span>
				{:else if notif === "unsupported"}
					<span class="badge warn">Unsupported</span>
				{:else}
					<button class="mini" onclick={enableNotif}>Enable</button>
				{/if}
			</div>

			<dl class="meta">
				<div><dt>Homeserver</dt><dd>{server}</dd></div>
				<div><dt>Spaces</dt><dd>{spaceCount}</dd></div>
				<div><dt>Rooms</dt><dd>{roomCount}</dd></div>
			</dl>

			<button class="logout" onclick={onLogout}>Log out</button>

			<p class="note">hoot prototype · connected to a live strix homeserver.</p>
		</div>
	</div>
</div>

<style>
.backdrop {
	position: fixed;
	inset: 0;
	z-index: 50;
	background: rgba(0, 0, 0, 0.55);
	display: grid;
	place-items: center;
	padding: 20px;
}
.modal {
	width: 100%;
	max-width: 440px;
	background: var(--panel);
	border: 1px solid var(--border);
	border-radius: 16px;
	box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
	overflow: hidden;
}
header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 16px;
	border-bottom: 1px solid var(--border);
}
header h2 {
	margin: 0;
	font-size: 16px;
}
.x {
	width: 30px;
	height: 30px;
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
.body {
	padding: 18px 16px 20px;
	display: flex;
	flex-direction: column;
	gap: 18px;
}
.who {
	display: flex;
	align-items: center;
	gap: 12px;
}
.av {
	width: 48px;
	height: 48px;
	border-radius: 14px;
	display: grid;
	place-items: center;
	font-size: 20px;
	font-weight: 800;
	color: #0b0c10;
	background: var(--c);
}
.who strong {
	font-size: 15px;
}
.mxid {
	font-size: 12px;
	color: var(--muted);
}
.field {
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.field > span {
	font-size: 12px;
	color: var(--muted);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}
.row {
	display: flex;
	gap: 8px;
}
.row input {
	flex: 1;
	height: 38px;
	padding: 0 12px;
	border-radius: 10px;
	background: var(--surface);
	border: 1px solid var(--border);
	color: var(--text);
	outline: none;
	font-size: 14px;
}
.row input:focus {
	border-color: var(--accent);
}
.save {
	padding: 0 16px;
	border-radius: 10px;
	border: none;
	background: var(--accent);
	color: #0b0c10;
	font-weight: 700;
	cursor: pointer;
}
.save:disabled {
	opacity: 0.45;
	cursor: default;
}
.meta {
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 1px;
	border: 1px solid var(--border);
	border-radius: 10px;
	overflow: hidden;
}
.meta > div {
	display: flex;
	justify-content: space-between;
	padding: 9px 12px;
	background: var(--surface);
	font-size: 13px;
}
.meta dt {
	color: var(--muted);
}
.meta dd {
	margin: 0;
	color: var(--text-dim);
	font-variant-numeric: tabular-nums;
}
.logout {
	height: 40px;
	border-radius: 10px;
	border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
	background: color-mix(in srgb, var(--danger) 12%, transparent);
	color: var(--danger);
	font-weight: 700;
	font-size: 13.5px;
	cursor: pointer;
}
.logout:hover {
	background: color-mix(in srgb, var(--danger) 20%, transparent);
}
.note {
	margin: 0;
	font-size: 12px;
	color: var(--muted);
	text-align: center;
}
.enc {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 12px;
	border: 1px solid var(--border);
	border-radius: 12px;
	background: var(--surface);
}
.enc-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.cap {
	font-size: 12px;
	color: var(--muted);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}
.badge {
	font-size: 12px;
	font-weight: 700;
	padding: 2px 9px;
	border-radius: 999px;
}
.badge.ok {
	color: var(--accent-2, #3fb950);
	background: color-mix(in srgb, #3fb950 16%, transparent);
}
.badge.warn {
	color: var(--e3b341, #e3b341);
	background: color-mix(in srgb, #e3b341 16%, transparent);
}
.enc-hint {
	margin: 0;
	font-size: 13px;
	color: var(--text-dim);
}
.flags {
	margin: 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 5px;
	font-size: 13px;
	color: var(--text-dim);
}
.recovery p {
	margin: 0 0 8px;
	font-size: 13px;
	color: var(--text-dim);
}
.rk {
	display: block;
	padding: 10px;
	border-radius: 8px;
	background: var(--panel);
	border: 1px solid var(--border);
	font-family: ui-monospace, monospace;
	font-size: 13px;
	letter-spacing: 0.5px;
	word-spacing: 2px;
	color: var(--text);
	user-select: all;
}
.rkrow {
	display: flex;
	gap: 8px;
	margin-top: 8px;
}
.mini {
	padding: 5px 12px;
	border-radius: 8px;
	border: 1px solid var(--border);
	background: var(--panel);
	color: var(--text);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
}
.mini:hover {
	border-color: var(--accent);
}
.link {
	align-self: flex-start;
	background: none;
	border: none;
	color: var(--accent);
	font-size: 12.5px;
	cursor: pointer;
	padding: 0;
}
.err {
	margin: 0;
	color: var(--danger);
	font-size: 12.5px;
}
.notif {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 11px 12px;
	border: 1px solid var(--border);
	border-radius: 12px;
	background: var(--surface);
}
</style>
