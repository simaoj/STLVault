import path from "path";
import fs from "fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const pkgJson = JSON.parse(
    fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
  );
  const appVersion = pkgJson.version || "dev";
  // In the Docker image these placeholders are swapped for real values by
  // frontend/env.sh at container start (see docker-compose.yml). Locally
  // (npm run dev / vite build outside Docker), no .env there is copied into
  // the image, so this falls back to the placeholder for that flow — set
  // VITE_API_URL / VITE_APP_URL in a frontend/.env.local to point at your
  // own backend during local development instead.
  const API_URL = env.VITE_API_URL || "TERA_API_URL";
  // Comma-separated list of hosts the frontend is reachable at (e.g. a LAN
  // hostname alongside localhost). allowedHosts needs bare hostnames, so
  // strip any scheme/port off each entry.
  const toHostname = (value: string): string => {
    try {
      return new URL(value.includes("://") ? value : `http://${value}`).hostname;
    } catch {
      return value;
    }
  };
  const APP_HOSTS = (env.VITE_APP_URL || "TERA_APP_URL")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map(toHostname);
  return {
    base: "/",
    preview: {
      port: 5173,
      allowedHosts: APP_HOSTS,
    },
    server: {
      port: 5173,
      host: "0.0.0.0",
      allowedHosts: APP_HOSTS,
    },
    define: {
      "import.meta.env.VITE_APP_TAG": JSON.stringify(appVersion),
      "import.meta.env.VITE_API_URL": JSON.stringify(API_URL),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
