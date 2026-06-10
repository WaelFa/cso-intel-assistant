import type { NextConfig } from "next";

const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3141";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Proxy all backend calls through Next.js so the browser sees
  // a single origin (no CORS, no env-var plumbing in client code).
  // Set BACKEND_INTERNAL_URL on the host to the Hono server's
  // internal URL (e.g. on Railway: http://cso-intel-assistant-api.railway.internal:3141).
  // Falls back to localhost:3141 for local dev.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_INTERNAL_URL}/api/:path*` },
      { source: "/agents/:path*", destination: `${BACKEND_INTERNAL_URL}/agents/:path*` },
      { source: "/tools/:path*", destination: `${BACKEND_INTERNAL_URL}/tools/:path*` },
      { source: "/workflows/:path*", destination: `${BACKEND_INTERNAL_URL}/workflows/:path*` },
    ];
  },
};

export default nextConfig;
