import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { ensureSessionSecret } from "./sessionSecret";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const secretSource = await ensureSessionSecret();
  console.log(`Session key loaded from ${secretSource}.`);
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  // Behind a hosting proxy (HTTPS terminates there). Do not trust it for rate-limit IPs.
  app.set("trust proxy", 1);
  // Not embeddable in other sites; no public indexing.
  app.use((req, res, next) => {
    res.set("X-Frame-Options", "DENY");
    res.set("Strict-Transport-Security", "max-age=31536000");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.set("Referrer-Policy", "no-referrer");
    res.set("X-Content-Type-Options", "nosniff");
    if (req.path.startsWith("/api/")) {
      res.set("Cache-Control", "private, no-store, max-age=0");
      res.set("Pragma", "no-cache");
    }
    next();
  });
  // The bounded bulletin schema needs no upload-sized request limit.
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "16kb", extended: false }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    (req, res, next) => {
      // A custom header cannot be sent cross-origin without an approved preflight.
      // Do not add permissive CORS; every mutation is also guarded in its procedure.
      if (req.method === "POST" && req.headers["x-churchconnect"] !== "1") {
        res
          .status(403)
          .json({ error: "Required application request header is missing." });
        return;
      }
      next();
    },
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
