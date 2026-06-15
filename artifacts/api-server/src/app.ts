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
    secret: process.env.SESSION_SECRET ?? "vaultx-secret-change-in-production",
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

async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const EXEMPT_PATHS = ["/api/health", "/api/auth/login", "/api/auth/register", "/api/auth/logout"];
  const isAdminRoute = req.path.startsWith("/api/admin");
  const isExempt = EXEMPT_PATHS.some((p) => req.path === p);

  if (isAdminRoute || isExempt) {
    next();
    return;
  }

  if (req.session?.isAdmin) {
    next();
    return;
  }

  try {
    const [setting] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "maintenance_mode")).limit(1);
    if (setting?.value === "true") {
      res.status(503).json({ error: "Maintenance", message: "The platform is currently under maintenance. Please try again later." });
      return;
    }
  } catch {
  }

  next();
}

app.use(maintenanceMiddleware);
app.use("/api", router);

startCronJobs();

export default app;
