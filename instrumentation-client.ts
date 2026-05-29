/**
 * Sentry client-side initialization.
 * E2EE constraint: NO user data, payloads, or decrypted content ever leaves the device.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;

      if (event.request.url) {
        try {
          const url = new URL(event.request.url);
          event.request.url = url.origin + url.pathname;
        } catch {
          delete event.request.url;
        }
      }
    }

    delete event.user;

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs
        .filter((b) => b.category !== "console") // no console output
        .map((b) => {
          if (b.data) {
            const safe: Record<string, unknown> = {};
            if (b.data.status_code) safe.status_code = b.data.status_code;
            if (b.data.method) safe.method = b.data.method;
            if (b.data.url) {
              try {
                const u = new URL(b.data.url as string);
                safe.url = u.origin + u.pathname;
              } catch {
                // omit malformed URLs
              }
            }
            b.data = safe;
          }
          return b;
        });
    }

    delete event.extra;
    if (event.contexts?.state) {
      delete event.contexts.state;
    }

    return event;
  },

  ignoreErrors: [
    "refresh_token_not_found",
    "Invalid Refresh Token",
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "Non-Error promise rejection captured",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
