import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server folder, used by the desktop app.
  output: "standalone",
  outputFileTracingRoot: __dirname,
  // Hide the floating Next.js dev badge; it covers the sidebar footer.
  devIndicators: false,
};

export default nextConfig;
