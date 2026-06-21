// Map matrix-js-sdk objects to the prop shapes our existing components expect.
import type {
	EventTimelineSet,
	MatrixClient,
	MatrixEvent,
	Room as SdkRoom,
} from "matrix-js-sdk";
import type {
	Member,
	Message,
	PollData,
	Reaction,
	Room,
	Space,
} from "$lib/client/mock";

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
function hhmm(ts: number): string {
	const d = new Date(ts);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const localpart = (u: string) => u.replace(/^@/, "").split(":")[0];
function stripReplyFallback(body: string): string {
	if (!body.startsWith("> ")) return body;
	const i = body.indexOf("\n\n");
	return i >= 0 ? body.slice(i + 2) : body;
}
function parseGeo(c: Content): { lat: number; lng: number } | undefined {
	const uri = c.geo_uri || c["org.matrix.msc3488.location"]?.uri;
	if (typeof uri !== "string") return undefined;
	const parts = uri.replace(/^geo:/, "").split(";")[0].split(",");
	const lat = Number(parts[0]);
	const lng = Number(parts[1]);
	return Number.isFinite(lat) && Number.isFinite(lng)
		? { lat, lng }
		: undefined;
}

// --- display-name resolution (strix omits displayname from member events) ---
const nameCache = new Map<string, string>();
const tried = new Set<string>();
const looksLikeMxid = (s: string) => s.startsWith("@") && s.includes(":");
export function nameOf(
	room: SdkRoom | null | undefined,
	userId: string,
): string {
	const name =
		nameCache.get(userId) || room?.getMember(userId)?.rawDisplayName || "";
	return name && !looksLikeMxid(name) ? name : localpart(userId);
}
export async function resolveNames(
	client: MatrixClient,
	userIds: Iterable<string>,
): Promise<boolean> {
	let changed = false;
	await Promise.all(
		[...new Set(userIds)]
			.filter((u) => u && !nameCache.has(u) && !tried.has(u))
			.map(async (u) => {
				tried.add(u);
				try {
					const p = await client.getProfileInfo(u);
					if (p.displayname) {
						nameCache.set(u, p.displayname);
						changed = true;
					}
				} catch {
					/* keep localpart */
				}
			}),
	);
	return changed;
}

// biome-ignore lint/suspicious/noExplicitAny: SDK event content
type Content = Record<string, any>;

function reactionsFor(
	set: EventTimelineSet,
	eventId: string,
	myId: string,
): Reaction[] {
	const rel = set.relations?.getChildEventsForEvent(
		eventId,
		"m.annotation",
		"m.reaction",
	);
	const out: Reaction[] = [];
	for (const [key, evs] of rel?.getSortedAnnotationsByKey() ?? []) {
		const live = [...evs].filter((e) => !e.isRedacted());
		if (!live.length) continue;
		const mine = live.find((e) => e.getSender() === myId);
		out.push({
			key,
			count: live.length,
			mine: !!mine,
			myReactionId: mine?.getId(),
		});
	}
	return out;
}

// --- polls (MSC3381, stable + unstable namespaces) ---
const POLL_START_TYPES = ["m.poll.start", "org.matrix.msc3381.poll.start"];
function pollText(o: unknown): string {
	if (typeof o === "string") return o;
	const oo = (o ?? {}) as Content;
	return oo["m.text"] ?? oo["org.matrix.msc1767.text"] ?? "";
}
function childEvents(set: EventTimelineSet, id: string, ...types: string[]) {
	for (const t of types) {
		const rel = set.relations?.getChildEventsForEvent(id, "m.reference", t);
		const events = rel?.getRelations() ?? [];
		if (events.length) return events;
	}
	return [];
}
function parsePoll(
	set: EventTimelineSet,
	e: MatrixEvent,
	myId: string,
): PollData {
	const c = e.getContent() as Content;
	const ps = c["m.poll.start"] ?? c["org.matrix.msc3381.poll.start"] ?? {};
	const question = pollText(ps.question);
	const options = ((ps.answers ?? []) as Content[]).map((a) => ({
		id: String(a.id),
		text: pollText(a),
		votes: 0,
		mine: false,
	}));
	const id = e.getId() ?? "";
	const responses = childEvents(
		set,
		id,
		"m.poll.response",
		"org.matrix.msc3381.poll.response",
	)
		.slice()
		.sort((a, b) => a.getTs() - b.getTs());
	const latest = new Map<string, string[]>();
	for (const re of responses) {
		if (re.isRedacted()) continue;
		const rc = re.getContent() as Content;
		const ans =
			(rc["m.poll.response"] ?? rc["org.matrix.msc3381.poll.response"])
				?.answers ?? [];
		latest.set(re.getSender() ?? "", ans);
	}
	for (const [user, ans] of latest) {
		for (const aid of ans) {
			const opt = options.find((o) => o.id === aid);
			if (opt) {
				opt.votes++;
				if (user === myId) opt.mine = true;
			}
		}
	}
	const totalVotes = [...latest.values()].filter((a) => a.length).length;
	const ended =
		childEvents(set, id, "m.poll.end", "org.matrix.msc3381.poll.end").length >
		0;
	return { id, question, ended, options, totalVotes };
}

function mapEvent(
	client: MatrixClient,
	room: SdkRoom,
	set: EventTimelineSet,
	e: MatrixEvent,
	myId: string,
): Message {
	const sender = e.getSender() ?? "";
	const ts = e.getTs();
	if (e.getType() === "m.room.encrypted" || e.isDecryptionFailure()) {
		return {
			id: e.getId() ?? `${ts}-${sender}`,
			sender: nameOf(room, sender),
			senderId: sender,
			color: colorFor(sender),
			body: "🔒 Unable to decrypt this message yet",
			ts: hhmm(ts),
			tsMs: ts,
			me: sender === myId,
			reactions: [],
		};
	}
	const orig = e.getContent() as Content;
	const rep = e.replacingEvent();
	const c: Content = rep ? (rep.getContent()["m.new_content"] ?? orig) : orig;
	const base: Message = {
		id: e.getId() ?? `${ts}-${sender}`,
		sender: nameOf(room, sender),
		senderId: sender,
		color: colorFor(sender),
		body: stripReplyFallback(String(c.body ?? "")),
		ts: hhmm(ts),
		tsMs: ts,
		me: sender === myId,
		edited: !!rep,
		replyToId: orig["m.relates_to"]?.["m.in_reply_to"]?.event_id,
		reactions: reactionsFor(set, e.getId() ?? "", myId),
	};
	if (POLL_START_TYPES.includes(e.getType())) {
		const poll = parsePoll(set, e, myId);
		return { ...base, kind: "poll", body: poll.question, poll };
	}
	if (c.msgtype === "m.image" && c.url) {
		return {
			...base,
			kind: "image",
			url: client.mxcUrlToHttp(c.url) ?? undefined,
			name: String(c.body ?? "image"),
		};
	}
	if (c.msgtype === "m.location") {
		const g = parseGeo(c);
		return { ...base, kind: "location", lat: g?.lat, lng: g?.lng };
	}
	if (c.msgtype === "m.audio" && c.url) {
		const audio = c["org.matrix.msc1767.audio"] ?? {};
		return {
			...base,
			kind: "audio",
			url: client.mxcUrlToHttp(c.url) ?? undefined,
			name: String(c.body ?? "audio"),
			duration: Number(c.info?.duration ?? audio.duration) || undefined,
			waveform: Array.isArray(audio.waveform) ? audio.waveform : undefined,
		};
	}
	if ((c.msgtype === "m.file" || c.msgtype === "m.video") && c.url) {
		return {
			...base,
			kind: "file",
			url: client.mxcUrlToHttp(c.url) ?? undefined,
			name: String(c.body ?? "file"),
		};
	}
	return base;
}

function isRenderable(e: MatrixEvent): boolean {
	const t = e.getType();
	return (
		(t === "m.room.message" ||
			t === "m.room.encrypted" ||
			POLL_START_TYPES.includes(t)) &&
		!e.isRedacted() &&
		(e.getContent() as Content)["m.relates_to"]?.rel_type !== "m.replace"
	);
}

// thread reply root (from the m.thread relation), computed directly off the
// timeline so we don't depend on the SDK's Thread machinery / server caps
function threadRoot(e: MatrixEvent): string | undefined {
	const rel = (e.getContent() as Content)["m.relates_to"];
	return rel?.rel_type === "m.thread" ? rel.event_id : undefined;
}

export function roomMessages(
	client: MatrixClient,
	roomId: string,
	myId: string,
): Message[] {
	const room = client.getRoom(roomId);
	if (!room) return [];
	const set = room.getUnfilteredTimelineSet();
	const events = room.getLiveTimeline().getEvents();
	// count thread replies per root
	const counts = new Map<string, number>();
	for (const e of events) {
		const r = threadRoot(e);
		if (r && isRenderable(e)) counts.set(r, (counts.get(r) ?? 0) + 1);
	}
	const out: Message[] = [];
	for (const e of events) {
		if (!isRenderable(e)) continue;
		if (threadRoot(e)) continue; // thread replies don't show in the main timeline
		const m = mapEvent(client, room, set, e, myId);
		const tc = counts.get(e.getId() ?? "");
		if (tc) m.threadCount = tc;
		out.push(m);
	}
	// read receipts: tag the last message each other member has read with their avatar
	const byId = new Map(out.map((m) => [m.id, m]));
	for (const mem of room.getJoinedMembers()) {
		if (mem.userId === myId) continue;
		const readId = room.getEventReadUpTo(mem.userId);
		const msg = readId ? byId.get(readId) : undefined;
		if (msg) {
			(msg.readBy ??= []).push({
				id: mem.userId,
				name: nameOf(room, mem.userId),
				color: colorFor(mem.userId),
			});
		}
	}
	return out;
}

// the root + replies of a single thread, for the thread panel
export function threadMessages(
	client: MatrixClient,
	roomId: string,
	rootId: string,
	myId: string,
): Message[] {
	const room = client.getRoom(roomId);
	if (!room) return [];
	const set = room.getUnfilteredTimelineSet();
	const out: Message[] = [];
	const rootEv = room.findEventById(rootId);
	if (rootEv && isRenderable(rootEv))
		out.push(mapEvent(client, room, set, rootEv, myId));
	for (const e of room.getLiveTimeline().getEvents()) {
		if (threadRoot(e) === rootId && isRenderable(e)) {
			out.push(mapEvent(client, room, set, e, myId));
		}
	}
	return out;
}

export function roomMembers(
	client: MatrixClient,
	roomId: string,
	myId: string,
): Member[] {
	const room = client.getRoom(roomId);
	if (!room) return [];
	return room.getJoinedMembers().map((m) => ({
		id: m.userId,
		name: nameOf(room, m.userId),
		color: colorFor(m.userId),
		role: m.powerLevel >= 100 ? "Admin" : m.powerLevel >= 50 ? "Mod" : "Member",
		power: m.powerLevel,
		online: m.user?.presence === "online" || m.userId === myId,
	}));
}

// Full-history server-side search (vs. filtering only the loaded timeline).
export async function searchRoom(
	client: MatrixClient,
	roomId: string,
	term: string,
	myId: string,
): Promise<Message[]> {
	const room = client.getRoom(roomId);
	if (!room || !term.trim()) return [];
	const set = room.getUnfilteredTimelineSet();
	const res = await client.searchRoomEvents({
		term,
		filter: { rooms: [roomId] },
	});
	const out: Message[] = [];
	for (const r of res.results ?? []) {
		const e = r.context.getEvent();
		const t = e?.getType();
		if (e && (t === "m.room.message" || t === "m.room.encrypted")) {
			out.push(mapEvent(client, room, set, e, myId));
		}
	}
	return out.sort((a, b) => a.tsMs - b.tsMs);
}

export function roomTyping(
	client: MatrixClient,
	roomId: string,
	myId: string,
): string[] {
	const room = client.getRoom(roomId);
	if (!room) return [];
	return room
		.getJoinedMembers()
		.filter((m) => m.typing && m.userId !== myId)
		.map((m) => nameOf(room, m.userId));
}

function mapRoom(client: MatrixClient, room: SdkRoom, myId: string): Room {
	const msgs = roomMessages(client, room.roomId, myId);
	const last = msgs.at(-1);
	const memberCount = room.getJoinedMemberCount();
	const hasName = !!room.currentState.getStateEvents("m.room.name", "");
	const isDm = !hasName && memberCount <= 2;
	const kind: "dm" | "group" = isDm ? "dm" : "group";
	let display = room.name;
	if (isDm) {
		const other = room.getJoinedMembers().find((m) => m.userId !== myId);
		if (other) display = nameOf(room, other.userId);
	}
	// the SDK falls back to the bare MXID when a member has no display name
	if (looksLikeMxid(display)) display = nameOf(room, display);
	const topicEv = room.currentState.getStateEvents("m.room.topic", "");
	return {
		id: room.roomId,
		spaceId: "home",
		name: display,
		kind,
		glyph: kind === "dm" ? (display[0]?.toUpperCase() ?? "?") : "#",
		color: colorFor(room.roomId),
		last: last?.body ?? "",
		lastSender: last?.me ? "you" : (last?.sender ?? ""),
		ts: last?.ts ?? "",
		unread: room.getUnreadNotificationCount() ?? 0,
		memberCount,
		encrypted: room.hasEncryptionStateEvent(),
		topic: (topicEv?.getContent() as Content | undefined)?.topic,
	};
}

export function listRooms(
	client: MatrixClient,
	myId: string,
): { spaces: Space[]; rooms: Room[] } {
	const spaces: Space[] = [];
	const joined = client
		.getRooms()
		.filter((r) => r.getMyMembership() === "join");
	joined.sort(
		(a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp(),
	);
	const rooms: Room[] = [];
	for (const room of joined) {
		if (room.isSpaceRoom()) {
			spaces.push({
				id: room.roomId,
				name: room.name,
				glyph: room.name[0]?.toUpperCase() ?? "S",
				color: colorFor(room.roomId),
			});
		} else {
			rooms.push(mapRoom(client, room, myId));
		}
	}
	return { spaces, rooms };
}

export function meInfo(myId: string, name: string) {
	return {
		name,
		id: myId,
		color: colorFor(myId),
		glyph: (name || myId || "?").charAt(0).toUpperCase(),
	};
}
