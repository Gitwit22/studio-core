import admin from "firebase-admin";
import { randomUUID } from "node:crypto";
import { firestore as db } from "../firebaseAdmin";
import type { HlsPresetId } from "./livekitEgress";

export type RoomDoc = {
  ownerId: string;
  livekitRoomName?: string;
  roomType?: string;
  status?: "idle" | "live" | "ended" | "scheduled" | string;
  createdAt?: FirebaseFirestore.Timestamp | admin.firestore.FieldValue | number | null;
  updatedAt?: FirebaseFirestore.Timestamp | admin.firestore.FieldValue | number | null;
  hls?: {
    status?: "idle" | "starting" | "live" | "error";
    runId?: string | null;
    egressId?: string | null;
    playlistUrl?: string | null;
    error?: string | null;
    presetId?: HlsPresetId;
    prefix?: string;
    startedAt?: FirebaseFirestore.Timestamp | null;
    updatedAt?: FirebaseFirestore.Timestamp | null;
  };
  [key: string]: any;
};

export async function ensureRoomDoc(params: {
  roomId: string;
  ownerId: string;
  livekitRoomName: string;
  roomType?: string;
  initialStatus?: string;
}): Promise<{
  ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  data: RoomDoc;
}> {
  const { roomId, ownerId, livekitRoomName, roomType, initialStatus } = params;
  const ref = db.collection("rooms").doc(roomId);
  const snap = await ref.get();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  if (!snap.exists) {
    const doc: Partial<RoomDoc> = {
      ownerId,
      roomType: roomType || "rtc",
      livekitRoomName,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      status: initialStatus || "live",
      hls: { status: "idle" },
    };

    await ref.set(doc as any, { merge: false });
  } else {
    const existing = (snap.data() || {}) as RoomDoc;
    const patch: Partial<RoomDoc> = {};

    if (!existing.ownerId) patch.ownerId = ownerId;
    if (!existing.roomType) patch.roomType = roomType || "rtc";
    if (!existing.livekitRoomName) patch.livekitRoomName = livekitRoomName;
    if (!("createdAt" in existing)) patch.createdAt = serverTimestamp;
    patch.updatedAt = serverTimestamp;
    if (!existing.status) patch.status = initialStatus || "live";
    if (!existing.hls) patch.hls = { status: "idle" };

    if (Object.keys(patch).length) {
      await ref.set(patch as any, { merge: true });
    }
  }

  const finalSnap = await ref.get();
  const data = (finalSnap.data() || {}) as RoomDoc;
  return { ref, data };
}

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
  const runId = randomUUID();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await roomRef.update({
    "hls.status": "starting",
    "hls.egressId": null,
    "hls.playlistUrl": null,
    "hls.error": null,
    "hls.presetId": params.presetId,
    "hls.prefix": params.prefix,
    "hls.runId": runId,
    "hls.startedAt": serverTimestamp,
    "hls.updatedAt": serverTimestamp,
  });
}

export async function setHlsLive(
  roomRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  params: { egressId: string; playlistUrl: string }
): Promise<void> {
  await roomRef.update({
    "hls.status": "live",
    "hls.egressId": params.egressId,
    "hls.playlistUrl": params.playlistUrl,
    "hls.error": null,
    "hls.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function setHlsError(
  roomRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  message: string
): Promise<void> {
  await roomRef.update({
    "hls.status": "error",
    "hls.egressId": null,
    "hls.playlistUrl": null,
    "hls.error": message,
    "hls.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function setHlsIdle(
  roomRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
): Promise<void> {
  await roomRef.update({
    "hls.status": "idle",
    "hls.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
  });
}
