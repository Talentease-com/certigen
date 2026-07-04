import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "fontkit", "pg"],
};

export default nextConfig;
