import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg", "pwa-192.png"],
      manifest: {
        name: "MarkIt — Smart Attendance",
        short_name: "MarkIt",
        description:
          "Smart attendance tracking for modern classrooms — dynamic QR, biometric verification, reports & analytics.",
        theme_color: "#4F46E5",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // SPA shell fallback — but never hijack API navigations
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // No runtime caching on purpose: attendance polls, QR tokens and
        // WebAuthn calls must always hit the network fresh.
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
