import withPWAInit from "@ducanh2912/next-pwa";

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  appDirOnly: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@xenova/transformers",
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, path: false, crypto: false };

    // Force libsodium-wrappers to resolve to its CJS build.
    // The ESM build (`dist/modules-esm/libsodium-wrappers.mjs`) has a
    // relative import `./libsodium.mjs` that breaks under pnpm's strict
    // node_modules isolation because the core `libsodium` package lives
    // in a separate `.pnpm` directory.
    //
    // This alias forces BOTH client and server webpack builds to use the
    // working CJS bundle instead.
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers": path.resolve(
        __dirname,
        "node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js",
      ),
    };

    // On the server, Next.js may resolve package.json "exports" with
    // the "import" condition first (picking the broken ESM entry).
    // Override conditionNames so "require" (CJS) is tried first.
    if (isServer) {
      config.resolve.conditionNames = ["require", "node", "default"];
    }

    return config;
  },
};

export default withPWA(nextConfig);
