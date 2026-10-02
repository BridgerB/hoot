// Stickers via im.ponies image packs (MSC2545). Packs live in account data
// (im.ponies.user_emotes) and room state (im.ponies.room_emotes); each maps
// shortcode -> { url(mxc), body?, usage?, info? }. We send m.sticker events.
import type { MatrixClient, Room } from "matrix-js-sdk";

const USER_EMOTES = "im.ponies.user_emotes";
const ROOM_EMOTES = "im.ponies.room_emotes";

type Usage = "emoticon" | "sticker";
type ImageInfo = { w?: number; h?: number; mimetype?: string; size?: number };
type PackImage = {
	url: string;
	body?: string;
	usage?: Usage[];
	info?: ImageInfo;
};
type PackContent = {
	pack?: { display_name?: string; usage?: Usage[] };
	images?: Record<string, PackImage>;
};

export type Sticker = {
	packName: string;
	shortcode: string;
	mxc: string; // what we send
	httpUrl: string; // what we show
	body: string;
	info?: ImageInfo;
};

function fromPack(client: MatrixClient, content: PackContent): Sticker[] {
	if (!content?.images) return [];
	const packUsage = content.pack?.usage ?? ["emoticon", "sticker"];
	const packName = content.pack?.display_name ?? "Stickers";
	const out: Sticker[] = [];
	for (const [shortcode, img] of Object.entries(content.images)) {
		if (typeof img?.url !== "string") continue;
		const usage = Array.isArray(img.usage) ? img.usage : packUsage;
		if (!usage.includes("sticker")) continue;
		out.push({
			packName,
			shortcode,
			mxc: img.url,
			httpUrl: client.mxcUrlToHttp(img.url) ?? "",
			body: img.body ?? shortcode,
			info: img.info,
		});
	}
	return out;
}

export function getStickers(client: MatrixClient, room: Room): Sticker[] {
	const out: Sticker[] = [];
	// biome-ignore lint/suspicious/noExplicitAny: account-data key not in the typed union
	const userEv = (client.getAccountData as any)(USER_EMOTES);
	if (userEv) out.push(...fromPack(client, userEv.getContent()));
	for (const ev of room.currentState.getStateEvents(ROOM_EMOTES) ?? []) {
		out.push(...fromPack(client, ev.getContent()));
	}
	return out;
}

export async function sendSticker(
	client: MatrixClient,
	roomId: string,
	s: Sticker,
) {
	// biome-ignore lint/suspicious/noExplicitAny: raw SDK send
	await (client.sendEvent as any)(roomId, "m.sticker", {
		body: s.body,
		url: s.mxc,
		info: s.info ?? {},
	});
}
