// Map matrix-js-sdk objects to the prop shapes our existing components expect.
import type { MatrixClient, MatrixEvent, Room as SdkRoom } from "matrix-js-sdk";
import type { Member, Message, Room, Space } from "$lib/client/mock";

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

export function mapEvent(
	client: MatrixClient,
	e: MatrixEvent,
	myId: string,
): Message | null {
	if (e.getType() !== "m.room.message" || e.isRedacted()) return null;
	const c = e.getContent();
	const sender = e.getSender() ?? "";
	const name =
		client.getRoom(e.getRoomId() ?? "")?.getMember(sender)?.name ??
		localpart(sender);
	const ts = e.getTs();
	const base: Message = {
		id: e.getId() ?? `${ts}-${sender}`,
		sender: name,
		senderId: sender,
		color: colorFor(sender),
		body: String(c.body ?? ""),
		ts: hhmm(ts),
		tsMs: ts,
		me: sender === myId,
		reactions: [],
		edited: !!e.replacingEvent(),
	};
	if (c.msgtype === "m.image" && c.url) {
		return {
			...base,
			kind: "image",
			url: client.mxcUrlToHttp(c.url) ?? undefined,
			name: String(c.body ?? "image"),
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
	return room
		.getLiveTimeline()
		.getEvents()
		.map((e) => mapEvent(client, e, myId))
		.filter((m): m is Message => !!m);
}

export function roomMembers(
	client: MatrixClient,
	roomId: string,
	myId: string,
): Member[] {
	const room = client.getRoom(roomId);
	if (!room) return [];
	return room.getJoinedMembers().map((m) => ({
		name: m.name,
		color: colorFor(m.userId),
		role: m.powerLevel >= 100 ? "Admin" : m.powerLevel >= 50 ? "Mod" : "Member",
		online: m.user?.presence === "online" || m.userId === myId,
	}));
}

function mapRoom(client: MatrixClient, room: SdkRoom, myId: string): Room {
	const msgs = roomMessages(client, room.roomId, myId);
	const last = msgs.at(-1);
	const memberCount = room.getJoinedMemberCount();
	const hasName = !!room.currentState.getStateEvents("m.room.name", "");
	const isDm = !hasName && memberCount <= 2;
	const kind: "dm" | "group" = isDm ? "dm" : "group";
	const topicEv = room.currentState.getStateEvents("m.room.topic", "");
	return {
		id: room.roomId,
		spaceId: "home",
		name: room.name,
		kind,
		glyph: kind === "dm" ? (room.name[0]?.toUpperCase() ?? "?") : "#",
		color: colorFor(room.roomId),
		last: last?.body ?? "",
		lastSender: last?.me ? "you" : (last?.sender ?? ""),
		ts: last?.ts ?? "",
		unread: room.getUnreadNotificationCount() ?? 0,
		memberCount,
		topic: topicEv?.getContent()?.topic,
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
