import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js dev-tools indicator (the floating "N" badge) in `next dev`.
  // It never renders in production builds; this just removes it from the dev view.
  devIndicators: false,
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
