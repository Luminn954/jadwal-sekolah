import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const buildId = Date.now().toString(36);

const buildVersionPlugin = {
  name: "jadwal-build-version",
  generateBundle(this: { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void }) {
    this.emitFile({
      type: "asset",
      fileName: "build-version.json",
      source: JSON.stringify({ buildId })
    });
  }
};

export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icons/192x192.png", "icons/512x512.png"],
      manifest: {
        name: "Jadwal Kelas",
        short_name: "Jadwal",
        description: "Lihat dan atur jadwal pelajaran mingguanmu.",
        lang: "id-ID",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f5f7f3",
        theme_color: "#f5f7f3",
        icons: [
          {
            src: "/icons/192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icons/512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html"
      },
      devOptions: { enabled: false }
    }),
    buildVersionPlugin
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4173"
    }
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
