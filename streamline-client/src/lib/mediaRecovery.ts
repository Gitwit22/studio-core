import { Track } from "livekit-client";

export const RECONNECT_MEDIA_MESSAGE_TYPE = "sl:reconnectMedia";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function encodeReconnectMediaMessage() {
  return new TextEncoder().encode(JSON.stringify({ type: RECONNECT_MEDIA_MESSAGE_TYPE }));
}

export function tryParseLiveKitDataMessage(payload: Uint8Array): any {
  try {
    const txt = new TextDecoder().decode(payload);
    return JSON.parse(txt || "{}");
  } catch {
    return null;
  }
}

export async function reconnectMedia(
  room: any,
  opts?: { audioDeviceId?: string; videoDeviceId?: string }
) {
  if (!room?.localParticipant) return;
  const lp: any = room.localParticipant;

  const wasMicEnabled = lp.isMicrophoneEnabled === true;
  const wasCamEnabled = lp.isCameraEnabled === true;

  // Stop existing mic publications (best-effort) so the browser releases the device.
  try {
    const pubs = Array.from(lp?.audioTrackPublications?.values?.() || []);
    const micPubs = pubs.filter((p: any) => p?.source === Track.Source.Microphone);
    for (const pub of micPubs) {
      const t: any = pub?.track;
      try {
        if (t && lp?.unpublishTrack) {
          await lp.unpublishTrack(t, true as any);
        }
      } catch {}
      try {
        if (t?.stop) t.stop();
      } catch {}
      try {
        const mst = t?.mediaStreamTrack;
        if (mst?.stop) mst.stop();
      } catch {}
    }
  } catch {}

  try {
    if (wasMicEnabled && lp.setMicrophoneEnabled) {
      await lp.setMicrophoneEnabled(false);
    }
    if (wasCamEnabled && lp.setCameraEnabled) {
      await lp.setCameraEnabled(false);
    }

    await sleep(150);

    if (opts?.audioDeviceId && room.switchActiveDevice) {
      try {
        await room.switchActiveDevice("audioinput", opts.audioDeviceId);
      } catch {}
    }
    if (opts?.videoDeviceId && room.switchActiveDevice) {
      try {
        await room.switchActiveDevice("videoinput", opts.videoDeviceId);
      } catch {}
    }

    await sleep(150);

    if (wasMicEnabled && lp.setMicrophoneEnabled) {
      await lp.setMicrophoneEnabled(true);
    }
    if (wasCamEnabled && lp.setCameraEnabled) {
      await lp.setCameraEnabled(true);
    }
  } catch {
    // Manual-only UX: no banners/overlays here.
  }
}
