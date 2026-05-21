// VAPID public key → ArrayBuffer for PushManager.subscribe().
//
// The applicationServerKey argument must be a BufferSource (ArrayBuffer or
// view). VAPID keys are distributed as base64url strings, so we decode here.
// Returning ArrayBuffer rather than Uint8Array sidesteps TS's recent
// Uint8Array<ArrayBufferLike> tightening, which trips the BufferSource
// signature with a SharedArrayBuffer-not-assignable error.

export function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}
