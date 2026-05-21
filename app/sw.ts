/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Step 11b — push + notification handlers.
//
// Payload contract (kept in sync with lib/notifications/payload.ts on the
// server side):
//   { title: string; body: string; deepLink: string; habitId: string }
// We use `tag: habitId` so a re-fire for the same habit replaces the previous
// notification instead of stacking, and `renotify: false` so the replacement
// doesn't vibrate twice.
// ---------------------------------------------------------------------------

type PushPayload = {
  title: string;
  body: string;
  deepLink: string;
  habitId: string;
};

function parsePayload(event: PushEvent): PushPayload | null {
  if (!event.data) return null;
  try {
    const json = event.data.json() as Partial<PushPayload>;
    if (
      typeof json?.title !== "string" ||
      typeof json?.body !== "string" ||
      typeof json?.deepLink !== "string" ||
      typeof json?.habitId !== "string"
    ) {
      return null;
    }
    return json as PushPayload;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  if (!payload) {
    // Spec-compliant fallback so the browser doesn't ding the user with the
    // OS-default "this site sent a notification" message in Chrome.
    event.waitUntil(
      self.registration.showNotification("Habit reminder", {
        body: "Time for a scheduled habit.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-monochrome-512.png",
        tag: "habit-reminder-generic",
      }),
    );
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-monochrome-512.png",
      tag: payload.habitId,
      renotify: false,
      data: { deepLink: payload.deepLink, habitId: payload.habitId },
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as { deepLink?: string };
  const target = data.deepLink ?? "/dashboard";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reuse an open tab on our origin if there is one — focus it and
      // navigate it to the deep link. Otherwise open a fresh window.
      for (const client of all) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // navigate() can reject if the client is cross-origin or has a
              // sandbox preventing it; falling back to openWindow keeps the
              // user-facing behaviour correct.
              await self.clients.openWindow(target);
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
