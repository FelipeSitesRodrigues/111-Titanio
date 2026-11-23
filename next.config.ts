import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "wyhgbwyfbxpezvweeiou.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  experimental: { serverActions: { bodySizeLimit: "12mb" }, authInterrupts: true },
};

export default nextConfig;
