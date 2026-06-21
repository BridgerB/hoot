// Server-only Matrix client for hoot. Runs in the SvelteKit node server so the
// access token never reaches the browser (kept in an httpOnly cookie, passed
// here as `Auth`). strix puts all events in `timeline.events` (empty `state`),
// with member counts + DM heroes in `summary`.
import type { Member, Message, Reaction, Room, Space } from "$lib/client/mock";

export const BASE = "http://129.153.101.92:8008";
const CS = (p: string) => `${BASE}/_matrix/client/v3${p}`;

export type Auth = { token: string; userId: string };

const PALETTE = [
	"#2f81f7",
	"#3fb950",
	"#a371f7",
	"#f778ba",
	"#e3b341",
	"#39c5cf",
	"#ff7b72",
	"#58a6ff",
];
function colorFor(id: string): string {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return PALETTE[h % PALETTE.length];
}
function hhmm(ts?: number): string {
	const d = ts ? new Date(ts) : new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const localpart = (u: string) => u.replace(/^@/, "").split(":")[0];

// biome-ignore lint/suspicious/noExplicitAny: raw C-S event content
type Content = Record<string, any>;
type Ev = {
	type: string;
	event_id?: string;
	sender?: string;
	state_key?: string;
	content?: Content;
	redacts?: string;
	origin_server_ts?: number;
};

export type ClientData = {
	ok: boolean;
	error?: string;
	server: string;
	nextBatch: string;
	me: { name: string; id: string; color: string; glyph: string };
	spaces: Space[];
	rooms: Room[];
	messages: Record<string, Message[]>;
	members: Record<string, Member[]>;
	prevBatch: Record<string, string>;
	receipts: Record<string, Record<string, string>>; // room -> user -> last-read event id
};

// ephemeral m.receipt -> { userId: eventId }
function parseReceipts(r: Record<string, unknown>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const e of (r.ephemeral as { events?: Ev[] } | undefined)?.events ??
		[]) {
		if (e.type !== "m.receipt") continue;
		for (const [eventId, byType] of Object.entries(e.content ?? {})) {
			const reads = (byType as Content)?.["m.read"] ?? {};
			for (const userId of Object.keys(reads)) out[userId] = eventId;
		}
	}
	return out;
}

async function cs(
	method: string,
	path: string,
	token?: string,
	body?: unknown,
) {
	const r = await fetch(CS(path), {
		method,
		headers: {
			"content-type": "application/json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	// biome-ignore lint/suspicious/noExplicitAny: raw C-S API JSON
	const data: any = await r.json().catch(() => ({}));
	return { status: r.status, data };
}

// --- auth ---
export async function login(user: string, pass: string): Promise<Auth> {
	const r = await cs("POST", "/login", undefined, {
		type: "m.login.password",
		identifier: { type: "m.id.user", user },
		password: pass,
	});
	if (r.status !== 200)
		throw new Error(r.data?.error || `login failed (${r.status})`);
	return { token: r.data.access_token, userId: r.data.user_id };
}
export async function register(user: string, pass: string): Promise<Auth> {
	let r = await cs("POST", "/register", undefined, {
		username: user,
		password: pass,
		inhibit_login: false,
	});
	if (r.status === 401 && r.data.session) {
		r = await cs("POST", "/register", undefined, {
			username: user,
			password: pass,
			auth: { type: "m.login.dummy", session: r.data.session },
		});
	}
	if (r.status !== 200)
		throw new Error(r.data?.error || `register failed (${r.status})`);
	return { token: r.data.access_token, userId: r.data.user_id };
}
export async function logout(token: string): Promise<void> {
	await cs("POST", "/logout", token).catch(() => {});
}

// --- display-name cache ---
const names: Record<string, string> = {};
async function resolveNames(token: string, users: Iterable<string>) {
	await Promise.all(
		[...new Set(users)]
			.filter((u) => u && !names[u])
			.map(async (u) => {
				try {
					const p = await cs(
						"GET",
						`/profile/${encodeURIComponent(u)}/displayname`,
						token,
					);
					if (p.status === 200 && p.data.displayname)
						names[u] = String(p.data.displayname);
				} catch {
					/* localpart fallback */
				}
			}),
	);
}
const dn = (u?: string) => (u ? (names[u] ?? localpart(u)) : "");

function mxcUrl(mxc?: unknown): string | undefined {
	if (typeof mxc !== "string" || !mxc.startsWith("mxc://")) return undefined;
	return `/api/media/${mxc.slice("mxc://".length)}`;
}

// strip the "> <@user> quoted\n\n" fallback that rich replies prepend
function stripReplyFallback(body: string): string {
	if (!body.startsWith("> ")) return body;
	const i = body.indexOf("\n\n");
	return i >= 0 ? body.slice(i + 2) : body;
}

function toMessage(e: Ev, myId: string): Message {
	const c = e.content ?? {};
	const rel = c["m.relates_to"];
	const base: Message = {
		id: e.event_id ?? `${e.origin_server_ts}-${e.sender}`,
		sender: dn(e.sender),
		senderId: e.sender,
		color: colorFor(e.sender ?? ""),
		body: stripReplyFallback(String(c.body ?? "")),
		ts: hhmm(e.origin_server_ts),
		tsMs: e.origin_server_ts ?? Date.now(),
		me: e.sender === myId,
		replyToId: rel?.["m.in_reply_to"]?.event_id,
		reactions: [],
	};
	if (c.msgtype === "m.image" && c.url) {
		const info = (c.info ?? {}) as Content;
		return {
			...base,
			kind: "image",
			url: mxcUrl(c.url),
			name: String(c.body ?? "image"),
			w: Number(info.w) || undefined,
			h: Number(info.h) || undefined,
		};
	}
	if (
		(c.msgtype === "m.file" ||
			c.msgtype === "m.video" ||
			c.msgtype === "m.audio") &&
		c.url
	) {
		return {
			...base,
			kind: "file",
			url: mxcUrl(c.url),
			name: String(c.body ?? "file"),
		};
	}
	return base;
}

function bumpReaction(
	m: Message | undefined,
	key: string,
	mine: boolean,
	eventId?: string,
) {
	if (!m) return;
	m.reactions = m.reactions ?? [];
	let r = m.reactions.find((x) => x.key === key);
	if (!r) {
		r = { key, count: 0, mine: false } as Reaction;
		m.reactions.push(r);
	}
	r.count++;
	if (mine) {
		r.mine = true;
		r.myReactionId = eventId;
	}
}

// build a room's display messages from raw timeline events, applying edits,
// reactions and redactions.
function buildMessages(events: Ev[], myId: string): Message[] {
	const byId = new Map<string, Message>();
	const order: string[] = [];
	const reactionRef = new Map<
		string,
		{ target: string; key: string; mine: boolean }
	>();

	for (const e of events) {
		if (e.type !== "m.room.message") continue;
		if (e.content?.["m.relates_to"]?.rel_type === "m.replace") continue;
		const m = toMessage(e, myId);
		byId.set(m.id, m);
		order.push(m.id);
	}
	for (const e of events) {
		if (e.type !== "m.room.message") continue;
		const rel = e.content?.["m.relates_to"];
		if (rel?.rel_type !== "m.replace") continue;
		const t = byId.get(rel.event_id);
		if (t) {
			t.body = stripReplyFallback(
				String(e.content?.["m.new_content"]?.body ?? t.body),
			);
			t.edited = true;
		}
	}
	for (const e of events) {
		if (e.type !== "m.reaction") continue;
		const rel = e.content?.["m.relates_to"];
		if (rel?.rel_type !== "m.annotation" || !rel.event_id || !rel.key) continue;
		const mine = e.sender === myId;
		if (e.event_id)
			reactionRef.set(e.event_id, { target: rel.event_id, key: rel.key, mine });
		bumpReaction(byId.get(rel.event_id), rel.key, mine, e.event_id);
	}
	for (const e of events) {
		if (e.type !== "m.room.redaction") continue;
		const target = e.redacts ?? (e.content?.redacts as string);
		if (!target) continue;
		if (byId.has(target)) {
			byId.delete(target);
			const i = order.indexOf(target);
			if (i >= 0) order.splice(i, 1);
		} else {
			const rr = reactionRef.get(target);
			const m = rr && byId.get(rr.target);
			const r = m?.reactions?.find((x) => x.key === rr?.key);
			if (m && r) {
				r.count--;
				if (rr.mine) {
					r.mine = false;
					r.myReactionId = undefined;
				}
				if (r.count <= 0)
					m.reactions = m.reactions?.filter((x) => x.key !== r.key);
			}
		}
	}
	return order.map((id) => byId.get(id)).filter((m): m is Message => !!m);
}

// --- initial load ---
export async function loadClient({
	token,
	userId: myId,
}: Auth): Promise<ClientData> {
	const empty: ClientData = {
		ok: false,
		server: BASE,
		nextBatch: "",
		me: { name: "", id: "", color: "#2f81f7", glyph: "?" },
		spaces: [],
		rooms: [],
		messages: {},
		members: {},
		prevBatch: {},
		receipts: {},
	};
	try {
		const sync = await cs("GET", "/sync?timeout=0", token);
		if (sync.status !== 200)
			return { ...empty, error: `sync HTTP ${sync.status}` };
		const join: Record<string, Record<string, unknown>> = sync.data.rooms
			?.join ?? {};

		// real presence (strix may or may not send it); you are always "online"
		const presence: Record<string, boolean> = { [myId]: true };
		for (const e of (sync.data.presence?.events ?? []) as Ev[]) {
			if (e.type === "m.presence" && e.sender)
				presence[e.sender] = e.content?.presence === "online";
		}

		const userSet = new Set<string>([myId]);
		for (const r of Object.values(join)) {
			for (const e of allEvents(r)) {
				if (e.type === "m.room.member" && e.state_key && e.content?.displayname)
					names[e.state_key] = String(e.content.displayname);
				if (e.type === "m.room.member" && e.state_key) userSet.add(e.state_key);
				if (e.type === "m.room.message" && e.sender) userSet.add(e.sender);
			}
		}
		await resolveNames(token, userSet);

		const spaces: Space[] = [];
		const childToSpace: Record<string, string> = {};
		const rooms: Room[] = [];
		const messages: Record<string, Message[]> = {};
		const members: Record<string, Member[]> = {};
		const prevBatch: Record<string, string> = {};
		const receipts: Record<string, Record<string, string>> = {};
		const lastTs: Record<string, number> = {};

		for (const [rid, r] of Object.entries(join)) {
			const st = latestState(r);
			if (st["m.room.create|"]?.content?.type === "m.space") {
				const nm = String(st["m.room.name|"]?.content?.name ?? "Space");
				spaces.push({
					id: rid,
					name: nm,
					glyph: nm.trim().charAt(0).toUpperCase(),
					color: colorFor(rid),
				});
				for (const e of Object.values(st)) {
					if (e.type === "m.space.child" && e.state_key && hasKeys(e.content))
						childToSpace[e.state_key] = rid;
				}
			}
		}

		for (const [rid, r] of Object.entries(join)) {
			const st = latestState(r);
			if (st["m.room.create|"]?.content?.type === "m.space") continue;
			const name = st["m.room.name|"]?.content?.name as string | undefined;
			const topic = st["m.room.topic|"]?.content?.topic as string | undefined;
			// biome-ignore lint/suspicious/noExplicitAny: summary is raw API
			const summary: any = (r.summary ?? {}) as any;
			const memberCount: number = summary["m.joined_member_count"] ?? 0;
			const heroes: string[] = summary["m.heroes"] ?? [];
			const isDm = !name && memberCount <= 2;
			const display = name ?? (isDm ? dn(heroes[0]) : "Room");
			const kind: "dm" | "group" = isDm ? "dm" : "group";

			const timeline = r.timeline as
				| { events?: Ev[]; prev_batch?: string }
				| undefined;
			const tl = timeline?.events ?? [];
			prevBatch[rid] = timeline?.prev_batch ?? "";
			receipts[rid] = parseReceipts(r);
			messages[rid] = buildMessages(tl, myId);
			const lastEv = tl.filter((e) => e.type === "m.room.message").at(-1);
			lastTs[rid] = lastEv?.origin_server_ts ?? 0;

			members[rid] = Object.values(st)
				.filter(
					(e) => e.type === "m.room.member" && e.content?.membership === "join",
				)
				.map((e) => e.state_key as string)
				.filter(Boolean)
				.map((u) => ({
					name: dn(u),
					color: colorFor(u),
					role: u === myId ? ("Admin" as const) : ("Member" as const),
					online: presence[u] ?? false,
				}));

			const lastMsg = messages[rid].at(-1);
			rooms.push({
				id: rid,
				spaceId: childToSpace[rid] ?? "home",
				name: display,
				kind,
				glyph: kind === "dm" ? display.charAt(0).toUpperCase() : "#",
				color: colorFor(rid),
				last: lastMsg?.body ?? "",
				lastSender: lastMsg?.me ? "you" : (lastMsg?.sender ?? ""),
				ts: lastMsg?.ts ?? "",
				unread:
					(
						r.unread_notifications as
							| { notification_count?: number }
							| undefined
					)?.notification_count ?? 0,
				topic,
				memberCount,
			});
		}

		rooms.sort((a, b) => (lastTs[b.id] ?? 0) - (lastTs[a.id] ?? 0));

		return {
			ok: true,
			server: BASE,
			nextBatch: sync.data.next_batch ?? "",
			me: {
				name: dn(myId) || localpart(myId),
				id: myId,
				color: colorFor(myId),
				glyph: (dn(myId) || localpart(myId) || "?").charAt(0).toUpperCase(),
			},
			spaces,
			rooms,
			messages,
			members,
			prevBatch,
			receipts,
		};
	} catch (e) {
		return { ...empty, error: String(e) };
	}
}

// --- actions ---
let txn = Date.now();
const next = () => `hoot${txn++}`;

export async function sendContent(
	{ token, userId }: Auth,
	roomId: string,
	content: Content,
): Promise<Message> {
	const id = next();
	const r = await cs(
		"PUT",
		`/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${id}`,
		token,
		content,
	);
	if (r.status !== 200) throw new Error(`send HTTP ${r.status}`);
	return toMessage(
		{
			type: "m.room.message",
			event_id: r.data.event_id ?? id,
			sender: userId,
			content,
			origin_server_ts: Date.now(),
		},
		userId,
	);
}
export async function sendMessage(
	auth: Auth,
	roomId: string,
	text: string,
): Promise<Message> {
	return sendContent(auth, roomId, { msgtype: "m.text", body: text });
}
export async function react(
	{ token }: Auth,
	roomId: string,
	eventId: string,
	key: string,
): Promise<{ eventId: string }> {
	const id = next();
	const r = await cs(
		"PUT",
		`/rooms/${encodeURIComponent(roomId)}/send/m.reaction/${id}`,
		token,
		{
			"m.relates_to": { rel_type: "m.annotation", event_id: eventId, key },
		},
	);
	if (r.status !== 200) throw new Error(`react HTTP ${r.status}`);
	return { eventId: r.data.event_id ?? id };
}
export async function redact(
	{ token }: Auth,
	roomId: string,
	eventId: string,
): Promise<void> {
	const r = await cs(
		"PUT",
		`/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(eventId)}/${next()}`,
		token,
		{},
	);
	if (r.status !== 200) throw new Error(`redact HTTP ${r.status}`);
}
export async function editMessage(
	{ token }: Auth,
	roomId: string,
	eventId: string,
	text: string,
): Promise<void> {
	const id = next();
	const r = await cs(
		"PUT",
		`/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${id}`,
		token,
		{
			msgtype: "m.text",
			body: `* ${text}`,
			"m.new_content": { msgtype: "m.text", body: text },
			"m.relates_to": { rel_type: "m.replace", event_id: eventId },
		},
	);
	if (r.status !== 200) throw new Error(`edit HTTP ${r.status}`);
}
export async function setTyping(
	{ token, userId }: Auth,
	roomId: string,
	typing: boolean,
): Promise<void> {
	await cs(
		"PUT",
		`/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(userId)}`,
		token,
		{
			typing,
			timeout: typing ? 6000 : 0,
		},
	).catch(() => {});
}
export async function readReceipt(
	{ token }: Auth,
	roomId: string,
	eventId: string,
): Promise<void> {
	await cs(
		"POST",
		`/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
		token,
		{},
	).catch(() => {});
}

// --- media ---
export async function uploadMedia(
	{ token }: Auth,
	filename: string,
	contentType: string,
	bytes: ArrayBuffer,
): Promise<{ mxc: string }> {
	const r = await fetch(
		`${BASE}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}`,
		{
			method: "POST",
			headers: {
				"content-type": contentType || "application/octet-stream",
				authorization: `Bearer ${token}`,
			},
			body: bytes,
		},
	);
	if (!r.ok) throw new Error(`upload HTTP ${r.status}`);
	const data = await r.json();
	return { mxc: data.content_uri };
}
export async function mediaDownload(
	{ token }: Auth,
	path: string,
): Promise<Response> {
	return fetch(`${BASE}/_matrix/media/v3/download/${path}`, {
		headers: { authorization: `Bearer ${token}` },
	});
}

// --- create room / space ---
export async function createRoom({ token }: Auth, name: string): Promise<Room> {
	const r = await cs("POST", "/createRoom", token, {
		name,
		preset: "private_chat",
	});
	if (r.status !== 200) throw new Error(`createRoom HTTP ${r.status}`);
	const id = r.data.room_id as string;
	return {
		id,
		spaceId: "home",
		name,
		kind: "group",
		glyph: "#",
		color: colorFor(id),
		last: "",
		lastSender: "",
		ts: hhmm(),
		unread: 0,
		memberCount: 1,
	};
}
export async function createSpace(
	{ token }: Auth,
	name: string,
): Promise<Space> {
	const r = await cs("POST", "/createRoom", token, {
		name,
		creation_content: { type: "m.space" },
		preset: "private_chat",
	});
	if (r.status !== 200) throw new Error(`createSpace HTTP ${r.status}`);
	const id = r.data.room_id as string;
	return {
		id,
		name,
		glyph: name.trim().charAt(0).toUpperCase(),
		color: colorFor(id),
	};
}

// --- profile ---
export async function setDisplayName(
	{ token, userId }: Auth,
	name: string,
): Promise<{ name: string }> {
	const r = await cs(
		"PUT",
		`/profile/${encodeURIComponent(userId)}/displayname`,
		token,
		{ displayname: name },
	);
	if (r.status !== 200) throw new Error(`displayname HTTP ${r.status}`);
	names[userId] = name;
	return { name };
}

// --- older history ---
export async function paginate(
	{ token, userId }: Auth,
	roomId: string,
	from: string,
): Promise<{ messages: Message[]; end: string }> {
	const r = await cs(
		"GET",
		`/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=40&from=${encodeURIComponent(from)}`,
		token,
	);
	if (r.status !== 200) return { messages: [], end: from };
	const chunk: Ev[] = (r.data.chunk ?? []).slice().reverse(); // dir=b is newest-first -> chronological
	await resolveNames(
		token,
		chunk
			.filter((e) => e.type === "m.room.message")
			.map((e) => e.sender ?? "")
			.filter(Boolean),
	);
	return { messages: buildMessages(chunk, userId), end: r.data.end ?? from };
}

// --- incremental sync (long-poll) ---
export type RoomDelta = {
	messages: Message[];
	edits: { id: string; body: string }[];
	reactions: { target: string; key: string; mine: boolean; eventId?: string }[];
	removed: string[];
	last?: { last: string; lastSender: string; ts: string };
	unread?: number;
};
export type SyncDelta = {
	nextBatch: string;
	rooms: Record<string, RoomDelta>;
	typing: Record<string, string[]>;
};
export async function syncSince(
	{ token, userId: myId }: Auth,
	since: string,
): Promise<SyncDelta> {
	const q = since
		? `?since=${encodeURIComponent(since)}&timeout=25000`
		: "?timeout=0";
	const sync = await cs("GET", `/sync${q}`, token);
	const join: Record<string, Record<string, unknown>> = sync.data.rooms?.join ??
	{};

	const senders = new Set<string>();
	const typingUsers = new Set<string>();
	for (const r of Object.values(join)) {
		for (const e of (r.timeline as { events?: Ev[] } | undefined)?.events ??
			[]) {
			if (e.type === "m.room.message" && e.sender) senders.add(e.sender);
		}
		for (const e of (r.ephemeral as { events?: Ev[] } | undefined)?.events ??
			[]) {
			if (e.type === "m.typing")
				for (const u of (e.content?.user_ids ?? []) as string[])
					typingUsers.add(u);
		}
	}
	await resolveNames(token, [...senders, ...typingUsers]);

	const rooms: Record<string, RoomDelta> = {};
	const typing: Record<string, string[]> = {};
	for (const [rid, r] of Object.entries(join)) {
		const tl = (r.timeline as { events?: Ev[] } | undefined)?.events ?? [];
		const delta: RoomDelta = {
			messages: [],
			edits: [],
			reactions: [],
			removed: [],
		};
		let lastMsg: Message | undefined;
		for (const e of tl) {
			if (e.type === "m.room.message") {
				const rel = e.content?.["m.relates_to"];
				if (rel?.rel_type === "m.replace") {
					if (rel.event_id)
						delta.edits.push({
							id: rel.event_id,
							body: stripReplyFallback(
								String(e.content?.["m.new_content"]?.body ?? ""),
							),
						});
				} else {
					const m = toMessage(e, myId);
					delta.messages.push(m);
					lastMsg = m;
				}
			} else if (e.type === "m.reaction") {
				const rel = e.content?.["m.relates_to"];
				if (rel?.rel_type === "m.annotation" && rel.event_id && rel.key) {
					delta.reactions.push({
						target: rel.event_id,
						key: rel.key,
						mine: e.sender === myId,
						eventId: e.event_id,
					});
				}
			} else if (e.type === "m.room.redaction") {
				const t = e.redacts ?? (e.content?.redacts as string);
				if (t) delta.removed.push(t);
			}
		}
		if (lastMsg)
			delta.last = {
				last: lastMsg.body,
				lastSender: lastMsg.me ? "you" : lastMsg.sender,
				ts: lastMsg.ts,
			};
		delta.unread = (
			r.unread_notifications as { notification_count?: number } | undefined
		)?.notification_count;
		if (
			delta.messages.length ||
			delta.edits.length ||
			delta.reactions.length ||
			delta.removed.length ||
			delta.unread !== undefined
		) {
			rooms[rid] = delta;
		}
		// typing (display names, excluding me)
		const tu: string[] = [];
		for (const e of (r.ephemeral as { events?: Ev[] } | undefined)?.events ??
			[]) {
			if (e.type === "m.typing")
				for (const u of (e.content?.user_ids ?? []) as string[])
					if (u !== myId) tu.push(dn(u));
		}
		typing[rid] = tu;
	}
	return { nextBatch: sync.data.next_batch ?? since, rooms, typing };
}

// --- helpers ---
function allEvents(r: Record<string, unknown>): Ev[] {
	const state = (r.state as { events?: Ev[] } | undefined)?.events ?? [];
	const timeline = (r.timeline as { events?: Ev[] } | undefined)?.events ?? [];
	return [...state, ...timeline];
}
function latestState(r: Record<string, unknown>): Record<string, Ev> {
	const out: Record<string, Ev> = {};
	for (const e of allEvents(r)) {
		if (e.state_key === undefined) continue;
		const k = `${e.type}|${e.state_key}`;
		const cur = out[k];
		if (!cur || (e.origin_server_ts ?? 0) >= (cur.origin_server_ts ?? 0))
			out[k] = e;
	}
	return out;
}
function hasKeys(o?: Record<string, unknown>): boolean {
	return !!o && Object.keys(o).length > 0;
}
