import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import { pool, db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import router from "./routes";
import { logger } from "./lib/logger";
import { startCronJobs } from "./lib/cron";

declare module "express-session" {
  interface SessionData {
    userId: number;
    isAdmin: boolean;
  }
}

const app: Express = express();

// Trust the Replit/reverse-proxy so secure cookies work in production
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET ?? "wexora-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

// Paths that are always accessible regardless of maintenance mode.
// IMPORTANT: /api/settings/public and /api/auth/me must be exempt so the
// frontend can detect maintenance status and know if the user is an admin.
const MAINTENANCE_EXEMPT = new Set([
  "/api/health",
  "/api/healthz",
  "/api/settings/public",
  "/api/auth/me",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

// ── Maintenance HTML page (served for browser requests) ──────────────────────
const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Maintenance — Wexora Global</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0a1628 0%,#0f2847 50%,#0a1628 100%);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
      color:#e2e8f0;padding:1rem}
    .card{background:rgba(15,23,42,0.8);backdrop-filter:blur(12px);
      border:1px solid rgba(148,163,184,0.1);border-radius:1.5rem;
      padding:3rem 2.5rem;max-width:440px;width:100%;text-align:center;
      box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)}
    .logo{font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:0.25rem;
      background:linear-gradient(135deg,#60a5fa,#34d399);-webkit-background-clip:text;
      -webkit-text-fill-color:transparent;background-clip:text}
    .tagline{font-size:0.8rem;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2rem}
    .icon-wrap{width:80px;height:80px;border-radius:50%;margin:0 auto 2rem;
      background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center}
    .icon-wrap .pulse{width:80px;height:80px;border-radius:50%;border:2px solid rgba(59,130,246,0.3);
      animation:pulse 2s ease-in-out infinite}
    @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:0.5}}
    .wrench{font-size:2rem;position:absolute}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:0.75rem;color:#f1f5f9}
    .msg{font-size:0.95rem;line-height:1.6;color:#94a3b8;margin-bottom:1.5rem}
    .eta{display:inline-block;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);
      border-radius:0.5rem;padding:0.5rem 1rem;font-size:0.85rem;color:#60a5fa;margin-bottom:1.5rem}
    .divider{height:1px;background:rgba(148,163,184,0.1);margin:1.5rem 0}
    .reassure{font-size:0.85rem;color:#64748b;line-height:1.5}
    .reassure strong{color:#94a3b8}
    .footer{margin-top:2rem;font-size:0.75rem;color:#475569}
    @media(max-width:480px){.card{padding:2rem 1.5rem}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Wexora Global</div>
    <div class="tagline">Crypto Investment Platform</div>
    <div class="icon-wrap" style="position:relative">
      <div class="pulse"></div>
      <span class="wrench">\u2699\uFE0F</span>
    </div>
    <h1>Scheduled Maintenance</h1>
    <p class="msg">Wexora Global is currently undergoing scheduled maintenance to improve our platform.</p>
    {{ETA}}
    <div class="divider"></div>
    <div class="reassure">
      <strong>Your account, investments, and balances remain safe.</strong><br/>
      No action is required on your part. We expect to be back online shortly.
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} Wexora Global. All rights reserved.</div>
  </div>
</body>
</html>`;

// ── Maintenance middleware ─────────────────────────────────────────────────────
// - Exempt paths, admin routes, and session-verified admins always pass through.
// - Browser requests get an HTML maintenance page.
// - API requests get a JSON response.
async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isAdminRoute = req.path.startsWith("/api/admin");
  const isExempt    = MAINTENANCE_EXEMPT.has(req.path);

  // Admin routes and always-exempt paths bypass maintenance entirely
  if (isAdminRoute || isExempt) {
    next();
    return;
  }

  // Session-verified admins bypass maintenance
  if (req.session?.isAdmin) {
    next();
    return;
  }

  try {
    const [setting] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "maintenance_mode"))
      .limit(1);

    if (setting?.value === "true") {
      const isApiRequest =
        req.path.startsWith("/api") ||
        req.headers.accept?.includes("application/json") ||
        req.headers["x-requested-with"] === "XMLHttpRequest";

      if (isApiRequest) {
        // API clients get JSON so they can handle the error programmatically
        res.status(503).json({
          maintenance: true,
          error: "Service Unavailable",
          message: "Wexora Global is currently undergoing scheduled maintenance. Your account, investments, and balances remain safe. Please try again shortly.",
        });
        return;
      }

      // Browser / human requests get a styled maintenance page
      let maintenanceEta = "";
      let maintenanceMsg = "";
      try {
        const [etaRow] = await db
          .select()
          .from(platformSettingsTable)
          .where(eq(platformSettingsTable.key, "maintenance_eta"))
          .limit(1);
        if (etaRow?.value) maintenanceEta = etaRow.value;

        const [msgRow] = await db
          .select()
          .from(platformSettingsTable)
          .where(eq(platformSettingsTable.key, "maintenance_message"))
          .limit(1);
        if (msgRow?.value) maintenanceMsg = msgRow.value;
      } catch { /* ignore — use defaults */ }

      const etaHtml = maintenanceEta
        ? `<div class="eta">Estimated return: ${maintenanceEta}</div>`
        : "";
      const html = MAINTENANCE_HTML.replace("{{ETA}}", etaHtml)
        .replace(/{{MESSAGE}}/g, maintenanceMsg || "");

      res.status(503).type("html").send(html);
      return;
    }
  } catch {
    // DB error — fail open so the platform stays accessible
  }

  next();
}

app.use(maintenanceMiddleware);
app.use("/api", router);

// ── Serve frontend static assets ──────────────────────────────────────────────
const publicDir = path.resolve(__dirname, "../../vaultx/dist/public");
app.use(express.static(publicDir));

// SPA fallback: any non-API, non-static-file request serves index.html
// (This lets React Router handle the client-side route)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(publicDir, "index.html"));
  }
});

startCronJobs();

export default app;
