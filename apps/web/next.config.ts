import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Load the repo-root .env so a single env file drives both apps.
const rootEnvPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(rootEnvPath)) {
  for (const line of fs.readFileSync(rootEnvPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@clearborder/shared"],
  serverExternalPackages: ["better-sqlite3"],
  env: {
    NEXT_PUBLIC_AGENT_PORT:
      process.env.NEXT_PUBLIC_AGENT_PORT ?? process.env.AGENT_PORT ?? "8787",
  },
};

export default nextConfig;
