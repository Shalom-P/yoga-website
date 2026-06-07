import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Supabase Storage public buckets (teacher-media, promotional-media) serve
    // avatar/cover images rendered via next/image. Allow that host so
    // optimization works instead of throwing on an unconfigured remote.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
