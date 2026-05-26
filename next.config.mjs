import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers"],
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, crypto: false };
    return config;
  },
};

export default withPWA(nextConfig);
