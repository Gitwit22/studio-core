import type admin from "firebase-admin";
import { firestore as db } from "../firebaseAdmin";
import type { HlsPresetId } from "./livekitEgress";

export type RoomDoc = {
  ownerId: string;
  roomType?: string;
  hls?: {
    status?: "idle" | "starting" | "live" | "error";
    egressId?: string | null;
    playlistUrl?: string | null;
    error?: string | null;
    presetId?: HlsPresetId;
    prefix?: string;
  };
  [key: string]: any;
};

export async function getRoom(roomId: string): Promise<{
  ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  data: RoomDoc;
}> {
  const ref = db.collection("rooms").doc(roomId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("room_not_found");
  }
  const data = snap.data() as RoomDoc;
  return { ref, data };
}

export async function setHlsStarting(
  roomRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  params: { presetId: HlsPresetId; prefix: string }
): Promise<void> {
  await roomRef.update({
    hls: {
      status: "starting",
      egressId: null,
      playlistUrl: null,
      error: null,
      presetId: params.presetId,
      prefix: params.prefix,
    },
  });
}

export async function setHlsLive(
  roomRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  params: { egressId: string; playlistUrl: string }
): Promise<void> {
  await roomRef.update({
    hls: {
      status: "live",
      egressId: params.egressId,
      playlistUrl: params.playlistUrl,
      error: null,
    },
  });
}

export async function setHlsError(
  roomRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  message: string
): Promise<void> {
  await roomRef.update({
    hls: {
      status: "error",
      egressId: null,
      playlistUrl: null,
      error: message,
    },
  });
}
