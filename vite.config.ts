import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;
// No session replay, network/body recording, or input collection: notes and activation keys are private.
export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(root, "client/src"),
      "@shared": path.resolve(root, "shared"),
      "@assets": path.resolve(root, "attached_assets"),
    },
  },
  envDir: root,
  root: path.resolve(root, "client"),
  publicDir: path.resolve(root, "client/public"),
  build: { outDir: path.resolve(root, "dist/public"), emptyOutDir: true },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      allow: [
        path.resolve(root, "client"),
        path.resolve(root, "shared"),
        path.resolve(root, "node_modules"),
      ],
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/.*",
        "**/.manus-logs/**",
        "**/docs/**",
        "**/scripts/**",
        "**/server/**",
        "**/drizzle/**",
        "**/*activation*",
        "**/*private*",
        "**/*.test.*",
      ],
    },
  },
});
