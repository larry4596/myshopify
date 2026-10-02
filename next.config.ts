import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the user home directory makes Turbopack infer
  // the wrong workspace root (warning during builds, slower dev server).
  // Pin the root to this repository instead.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // Our product images in /public/products are SVG placeholders.
    // Next.js blocks SVGs in the image optimizer by default; the sandboxed
    // content-security-policy below keeps serving them safe (no scripts).
    // Remove this once the images are replaced with real photos (JPG/PNG).
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Signed-in user avatars come from Google profile photos.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
