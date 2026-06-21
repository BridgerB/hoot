// Shared UI types + the room-list filter set. (Originally held mock data; the
// app now loads everything live from the homeserver — only types remain.)

export type Space = { id: string; name: string; glyph: string; color: string };

export type Room = {
	id: string;
	spaceId: string; // which space it belongs to ("home" = no space)
	name: string;
	kind: "dm" | "group";
	glyph: string;
	color: string;
	last: string;
	lastSender: string;
	ts: string;
	unread: number;
	muted?: boolean;
	topic?: string;
	memberCount?: number;
	encrypted?: boolean;
};

export type Reaction = {
	key: string;
	count: number;
	mine: boolean;
	myReactionId?: string;
};

export type Message = {
	id: string;
	sender: string;
	senderId?: string;
	color: string;
	body: string;
	ts: string;
	tsMs: number;
	me?: boolean;
	kind?: "text" | "image" | "file";
	url?: string; // resolved /api/media proxy url for image/file
	name?: string; // file name
	w?: number;
	h?: number;
	reactions?: Reaction[];
	replyToId?: string;
	edited?: boolean;
};

export type Member = {
	name: string;
	color: string;
	role: "Admin" | "Mod" | "Member";
	online: boolean;
};

export const FILTERS = ["All", "Unread", "DMs", "Groups"] as const;
export type Filter = (typeof FILTERS)[number];
