// Map matrix-js-sdk objects to the prop shapes our existing components expect.
import type {
	EventTimelineSet,
	MatrixClient,
	MatrixEvent,
	Room as SdkRoom,
} from "matrix-js-sdk";
import type { Member, Message, Reaction, Room, Space } from "$lib/client/mock";

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

export function roomMessages(
	client: MatrixClient,
	roomId: string,
	myId: string,
): Message[] {
	const room = client.getRoom(roomId);
	if (!room) return [];
	const set = room.getUnfilteredTimelineSet();
	return room
		.getLiveTimeline()
		.getEvents()
		.filter(
			(e) =>
				(e.getType() === "m.room.message" ||
					e.getType() === "m.room.encrypted") &&
				!e.isRedacted() &&
				(e.getContent() as Content)["m.relates_to"]?.rel_type !== "m.replace",
		)
		.map((e) => mapEvent(client, room, set, e, myId));
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
