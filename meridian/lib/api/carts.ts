import { request } from "./client";
import {
  cartListResponseSchema,
  cartSchema,
  type Cart,
  type CartListResponse,
} from "./schemas";

/** Carts API surface for DummyJSON. */

export interface CartListParams {
  limit?: number;
  skip?: number;
}

/** `GET /carts` — paginated cart list. */
export function getCarts(
  params: CartListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<CartListResponse> {
  return request("/carts", {
    query: { limit: params.limit, skip: params.skip },
    schema: cartListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /carts/{id}` — a single cart. Unknown ids produce a 404 `ApiError`. */
export function getCart(
  id: number,
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<Cart> {
  return request(`/carts/${encodeURIComponent(String(id))}`, {
    schema: cartSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /carts/user/{userId}` — paginated carts belonging to one user. */
export function getCartsByUser(
  userId: number,
  params: CartListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<CartListResponse> {
  return request(`/carts/user/${encodeURIComponent(String(userId))}`, {
    query: { limit: params.limit, skip: params.skip },
    schema: cartListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}
