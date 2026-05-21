"use client";

// Web Bluetooth wrapper for the Heart Rate Service (0x180D). Parses the
// Heart Rate Measurement characteristic (0x2A37) — first byte is a flag bitmask
// whose lowest bit indicates whether BPM is 8-bit (byte 1) or 16-bit (bytes 1+2,
// little-endian). See Bluetooth GATT spec, "Heart Rate Measurement".
//
// Android Chrome only. iOS Safari and Firefox lack Web Bluetooth entirely; the
// /fitness/live screen gates on `isHeartRateSupported()` before exposing the
// pair button.

const HEART_RATE_SERVICE = "heart_rate";
const HEART_RATE_MEASUREMENT = "heart_rate_measurement";

export type HeartRateSample = { t: number; bpm: number };

export type HeartRateConnection = {
  deviceName: string;
  disconnect: () => void;
  onSample: (cb: (s: HeartRateSample) => void) => () => void;
  onDisconnect: (cb: () => void) => () => void;
};

export function isHeartRateSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth !==
      "undefined"
  );
}

function parseHeartRate(view: DataView): number | null {
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  const is16Bit = (flags & 0x01) === 0x01;
  if (is16Bit) {
    if (view.byteLength < 3) return null;
    return view.getUint16(1, /* littleEndian */ true);
  }
  return view.getUint8(1);
}

export async function connectHeartRateMonitor(): Promise<HeartRateConnection> {
  if (!isHeartRateSupported()) {
    throw new Error("Web Bluetooth not supported in this browser.");
  }
  const bluetooth = (navigator as Navigator & { bluetooth: Bluetooth })
    .bluetooth;

  const device = await bluetooth.requestDevice({
    filters: [{ services: [HEART_RATE_SERVICE] }],
  });
  if (!device.gatt) {
    throw new Error("Device has no GATT server.");
  }
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(HEART_RATE_SERVICE);
  const characteristic = await service.getCharacteristic(
    HEART_RATE_MEASUREMENT,
  );

  const sampleListeners = new Set<(s: HeartRateSample) => void>();
  const disconnectListeners = new Set<() => void>();

  const handleChange = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const bpm = parseHeartRate(target.value);
    if (bpm === null || bpm <= 0) return;
    const sample: HeartRateSample = { t: Date.now(), bpm };
    for (const cb of sampleListeners) cb(sample);
  };

  const handleDisconnect = () => {
    for (const cb of disconnectListeners) cb();
  };

  characteristic.addEventListener("characteristicvaluechanged", handleChange);
  device.addEventListener("gattserverdisconnected", handleDisconnect);

  await characteristic.startNotifications();

  return {
    deviceName: device.name ?? "Heart rate monitor",
    disconnect() {
      try {
        characteristic.removeEventListener(
          "characteristicvaluechanged",
          handleChange,
        );
        device.removeEventListener("gattserverdisconnected", handleDisconnect);
        if (device.gatt?.connected) device.gatt.disconnect();
      } catch {
        // Best-effort cleanup; some adapters throw on double-disconnect.
      }
      sampleListeners.clear();
      disconnectListeners.clear();
    },
    onSample(cb) {
      sampleListeners.add(cb);
      return () => sampleListeners.delete(cb);
    },
    onDisconnect(cb) {
      disconnectListeners.add(cb);
      return () => disconnectListeners.delete(cb);
    },
  };
}
