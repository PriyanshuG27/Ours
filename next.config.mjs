import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  appDirOnly: true,
  sw: "pwa-sw.js",
  fallbacks: {
    document: "/_offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@xenova/transformers",
  ],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, path: false, crypto: false };

    // Force libsodium-wrappers to resolve to its CJS build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers": path.resolve(
        __dirname,
        "node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js",
      ),
    };

    if (isServer) {
      config.resolve.conditionNames = ["require", "node", "default"];
    }

    return config;
  },
};

const sentryConfig = {
  // Source map upload — only active when SENTRY_AUTH_TOKEN is set in CI/Vercel
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Do NOT send source maps in local dev (no token, no org)
  silent: !process.env.CI,

  // Disable telemetry back to Sentry about the SDK itself
  telemetry: false,

  // Do NOT widen bundle — tree-shake Sentry
  widenClientFileUpload: false,

  // Hide Sentry source map upload logs unless CI
  hideSourceMaps: true,

  // Disable automatic instrumentation of Next.js API routes
  // We call Sentry.captureException() explicitly where needed
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
  }
};

export default withSentryConfig(withPWA(nextConfig), sentryConfig);
