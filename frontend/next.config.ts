import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8100";

const nextConfig: NextConfig = {
  output: "standalone",
  // Don't generate AGENTS.md / CLAUDE.md in the project when the dev server starts.
  agentRules: false,
  // The browser talks to /api on the same origin; Next.js proxies it to the FastAPI backend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
