import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
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
  "/api/settings/public",
  "/api/auth/me",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

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
      res.status(503).json({
        maintenance: true,
        error: "Service Unavailable",
        message: "Wexora Global is currently undergoing scheduled maintenance. Your account, investments, and balances remain safe. Please try again shortly.",
      });
      return;
    }
  } catch {
    // DB error — fail open so the platform stays accessible
  }

  next();
}

app.use(maintenanceMiddleware);
app.use("/api", router);

startCronJobs();

export default app;
