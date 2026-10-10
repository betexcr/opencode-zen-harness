/**
 * Minimal `.env` loader (no third-party dependency). Existing process
 * environment values always win, so real deployments override file defaults.
 */

import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

export function loadDotEnv(dir: string = process.cwd()): void {
  const file = path.join(dir, ".env");
  if (!existsSync(file)) return;
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key.length > 0 && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
