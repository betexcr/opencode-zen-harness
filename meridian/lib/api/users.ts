import { request } from "./client";
import {
  userListResponseSchema,
  userSchema,
  type User,
  type UserListResponse,
} from "./schemas";

/**
 * Users API surface for DummyJSON.
 *
 * IMPORTANT: the returned `User` objects include sensitive demo fields
 * (`password`, `ssn`, `bank`, `ein`, `userAgent`, `crypto`). These MUST NOT be
 * rendered. Presentation code must project through `toPublicUser` from
 * `lib/api/schemas` (or select only safe fields) before touching the UI.
 */

export type SelectFields = string | readonly string[];

function normalizeSelect(select?: SelectFields): string | undefined {
  if (select === undefined) return undefined;
  if (typeof select === "string") {
    const trimmed = select.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const fields = select.filter((field) => field.trim().length > 0);
  return fields.length > 0 ? fields.join(",") : undefined;
}

export interface UserListParams {
  limit?: number;
  skip?: number;
  select?: SelectFields;
}

/** `GET /users` — paginated user list. */
export function getUsers(
  params: UserListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<UserListResponse> {
  return request("/users", {
    query: {
      limit: params.limit,
      skip: params.skip,
      select: normalizeSelect(params.select),
    },
    schema: userListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /users/{id}` — a single user. Unknown ids produce a 404 `ApiError`. */
export function getUser(
  id: number,
  options?: { select?: SelectFields; signal?: AbortSignal; baseUrl?: string },
): Promise<User> {
  return request(`/users/${encodeURIComponent(String(id))}`, {
    query: { select: normalizeSelect(options?.select) },
    schema: userSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /users/search?q=` — full-text user search. */
export function searchUsers(
  query: string,
  params: UserListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<UserListResponse> {
  return request("/users/search", {
    query: {
      q: query.trim(),
      limit: params.limit,
      skip: params.skip,
      select: normalizeSelect(params.select),
    },
    schema: userListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}
