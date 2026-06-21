// 1:1 voice/video calls via matrix-js-sdk (legacy MatrixCall, peer-to-peer
// WebRTC signalled over room events). Needs TURN (coturn) on the homeserver to
// traverse NAT. Group calls are a separate subsystem (Element Call + LiveKit).
import {
	CallEvent,
	createNewMatrixCall,
	type MatrixCall,
	type MatrixClient,
} from "matrix-js-sdk";
import { CallErrorCode } from "matrix-js-sdk/lib/webrtc/call";
import type { CallFeed } from "matrix-js-sdk/lib/webrtc/callFeed";

class CallController {
	call = $state<MatrixCall | null>(null);
	incoming = $state<MatrixCall | null>(null);
	feeds = $state<CallFeed[]>([]);
	micMuted = $state(false);
	vidMuted = $state(false);
	state = $state("");
	#client: MatrixClient | null = null;

	init(client: MatrixClient) {
		this.#client = client;
		// raw string — CallEventHandlerEvent isn't on the public barrel
		// biome-ignore lint/suspicious/noExplicitAny: untyped event name
		client.on("Call.incoming" as any, (call: MatrixCall) => {
			this.incoming = call;
			this.#wire(call);
		});
	}

	placeCall(roomId: string, video: boolean) {
		if (!this.#client) return;
		const call = createNewMatrixCall(this.#client, roomId);
		if (!call) return;
		this.#wire(call);
		this.call = call;
		if (video) call.placeVideoCall();
		else call.placeVoiceCall();
	}

	async answer(video: boolean) {
		const call = this.incoming;
		if (!call) return;
		this.call = call;
		this.incoming = null;
		await call.answer(true, video);
	}

	reject() {
		this.incoming?.reject();
		this.incoming = null;
	}

	hangup() {
		this.call?.hangup(CallErrorCode.UserHangup, false);
	}

	async toggleMic() {
		if (this.call)
			this.micMuted = await this.call.setMicrophoneMuted(!this.micMuted);
	}
	async toggleVid() {
		if (this.call)
			this.vidMuted = await this.call.setLocalVideoMuted(!this.vidMuted);
	}

	#wire(call: MatrixCall) {
		const sync = () => {
			this.feeds = call.getFeeds();
		};
		call.on(CallEvent.FeedsChanged, sync);
		call.on(CallEvent.State, (s: string) => {
			this.state = s;
			if (s === "ended") this.#teardown(call);
		});
		call.on(CallEvent.Hangup, () => this.#teardown(call));
		call.on(CallEvent.Error, () => this.#teardown(call));
		sync();
	}

	#teardown(call: MatrixCall) {
		call.removeAllListeners();
		if (this.call === call) this.call = null;
		if (this.incoming === call) this.incoming = null;
		this.feeds = [];
		this.micMuted = false;
		this.vidMuted = false;
		this.state = "";
	}
}

export const callController = new CallController();
