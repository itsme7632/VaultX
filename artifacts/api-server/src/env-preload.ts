/**
 * env-preload.ts
 *
 * Loaded via `node --import=./dist/env-preload.mjs` before any other module.
 * Finds the workspace-root .env file and loads it into process.env using dotenv.
 *
 * - On Replit: env vars are already injected by the platform; dotenv's
 *   `override: false` ensures they are never overwritten.
 * - On a VPS: reads the .env from the workspace root so the app starts without
 *   any manual `export` commands.
 * - If the .env file is absent dotenv returns an error object (it does NOT throw),
 *   so this is safe to run in any environment.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Compiled output lives at:  artifacts/api-server/dist/env-preload.mjs
// Workspace root is 3 levels up:  dist → api-server → artifacts → workspace-root
const envPath = resolve(__dirname, "..", "..", "..", ".env");

config({ path: envPath, override: false });
