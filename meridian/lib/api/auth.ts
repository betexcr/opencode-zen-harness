import { request } from "./client";
import {
  authSessionSchema,
  loginRequestSchema,
  type AuthSession,
  type LoginRequest,
} from "./schemas";

/**
 * Auth API surface for DummyJSON (DEMO ONLY).
 *
 * `POST /auth/login` is a mock endpoint. The returned access/refresh tokens are
 * inert strings that grant no real authority and are never validated by any
 * server. Do NOT present this as durable server-side authentication, and do NOT
 * invent registration, password-reset, or session-refresh backends — DummyJSON
 * provides none of those.
 *
 * Verified demo credentials: `emilys` / `emilyspass`.
 */

export interface LoginOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

/**
 * `POST /auth/login` — demo sign-in. The request body is validated locally
 * before the call, and the response is validated with `authSessionSchema`.
 */
export async function login(
  credentials: LoginRequest,
  options: LoginOptions = {},
): Promise<AuthSession> {
  const body = loginRequestSchema.parse(credentials);
  return request("/auth/login", {
    method: "POST",
    body,
    schema: authSessionSchema,
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}
