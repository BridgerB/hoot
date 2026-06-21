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
	kind?: "text" | "image" | "file" | "audio" | "location" | "poll";
	url?: string; // resolved media url for image/file/audio
	name?: string; // file name
	w?: number;
	h?: number;
	reactions?: Reaction[];
	replyToId?: string;
	edited?: boolean;
	// audio (voice message)
	duration?: number; // ms
	waveform?: number[];
	// location
	lat?: number;
	lng?: number;
	// poll
	poll?: PollData;
};

export type PollData = {
	id: string; // poll start event id
	question: string;
	ended: boolean;
	options: { id: string; text: string; votes: number; mine: boolean }[];
	totalVotes: number;
};

export type Member = {
	id: string;
	name: string;
	color: string;
	role: "Admin" | "Mod" | "Member";
	power: number;
	online: boolean;
};

export const FILTERS = ["All", "Unread", "DMs", "Groups"] as const;
export type Filter = (typeof FILTERS)[number];
