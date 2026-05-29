import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === "production",
      tracesSampleRate: 0.05,
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
        delete event.extra;

        if (Array.isArray(event.breadcrumbs)) {
          event.breadcrumbs = event.breadcrumbs.map((b) => {
            if (b.data) {
              const safe: Record<string, unknown> = {};
              if (b.data.status_code) safe.status_code = b.data.status_code;
              if (b.data.method) safe.method = b.data.method;
              b.data = safe;
            }
            return b;
          });
        }

        return event;
      },
      ignoreErrors: [
        "refresh_token_not_found",
        "Invalid Refresh Token",
        "NEXT_NOT_FOUND",
        "NEXT_REDIRECT",
      ],
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === "production",
      tracesSampleRate: 0,
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          delete event.request.headers;
        }
        delete event.user;
        delete event.extra;
        return event;
      },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
