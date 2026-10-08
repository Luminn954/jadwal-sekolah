import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
    })
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
