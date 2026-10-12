import { describe, expect, it } from "vitest";
import {
  authSessionSchema,
  cartListResponseSchema,
  cartSchema,
  categoryListSchema,
  loginRequestSchema,
  productCategoriesSchema,
  productCategorySchema,
  productListResponseSchema,
  productSchema,
  publicUserSchema,
  toPublicUser,
  userListResponseSchema,
  userSchema,
} from "@/lib/api/schemas";
import { makeAuthSession, makeCart, makeProduct, makeUser } from "./fixtures";

describe("productSchema", () => {
  it("accepts a full verified product payload", () => {
    expect(productSchema.safeParse(makeProduct()).success).toBe(true);
  });

  it("accepts a product without an optional brand", () => {
    const product = makeProduct();
    delete (product as { brand?: string }).brand;
    expect(productSchema.safeParse(product).success).toBe(true);
  });

  it("rejects a short payload missing required fields", () => {
    const { id, title } = makeProduct();
    expect(productSchema.safeParse({ id, title }).success).toBe(false);
  });

  it("rejects a payload with a wrong field type", () => {
    const product = { ...makeProduct(), price: "9.99" };
    expect(productSchema.safeParse(product).success).toBe(false);
  });

  it("rejects a malformed nested dimensions object", () => {
    const product = { ...makeProduct(), dimensions: { width: 1, height: 2 } };
    expect(productSchema.safeParse(product).success).toBe(false);
  });
});

describe("productListResponseSchema", () => {
  it("accepts a wrapped, paginated list response", () => {
    const payload = { products: [makeProduct()], total: 194, skip: 0, limit: 10 };
    expect(productListResponseSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a bare array (the categories shape)", () => {
    expect(productListResponseSchema.safeParse([makeProduct()]).success).toBe(false);
  });

  it("rejects a missing pagination envelope", () => {
    expect(productListResponseSchema.safeParse({ products: [makeProduct()] }).success).toBe(false);
  });

  it("rejects a payload containing an invalid product", () => {
    const payload = { products: [{ id: 1 }], total: 1, skip: 0, limit: 1 };
    expect(productListResponseSchema.safeParse(payload).success).toBe(false);
  });
});

describe("product categories", () => {
  it("validates a single category", () => {
    const category = { slug: "beauty", name: "Beauty", url: "https://dummyjson.com/products/category/beauty" };
    expect(productCategorySchema.safeParse(category).success).toBe(true);
  });

  it("validates the bare categories array", () => {
    const payload = [
      { slug: "beauty", name: "Beauty", url: "https://dummyjson.com/products/category/beauty" },
    ];
    expect(productCategoriesSchema.safeParse(payload).success).toBe(true);
  });

  it("validates the bare slug string array", () => {
    expect(categoryListSchema.safeParse(["beauty", "fragrances"]).success).toBe(true);
    expect(categoryListSchema.safeParse(["beauty", 3]).success).toBe(false);
  });
});

describe("userSchema", () => {
  it("accepts a full verified user payload", () => {
    expect(userSchema.safeParse(makeUser()).success).toBe(true);
  });

  it("accepts a user without optional sensitive demo fields", () => {
    const user = makeUser();
    delete (user as { password?: string }).password;
    delete (user as { ssn?: string }).ssn;
    delete (user as { bank?: unknown }).bank;
    delete (user as { ein?: string }).ein;
    delete (user as { userAgent?: string }).userAgent;
    delete (user as { crypto?: unknown }).crypto;
    expect(userSchema.safeParse(user).success).toBe(true);
  });

  it("rejects a short payload missing required identity fields", () => {
    expect(userSchema.safeParse({ id: 1, firstName: "Emily" }).success).toBe(false);
  });

  it("rejects a malformed nested address", () => {
    const user = { ...makeUser(), address: { city: "Phoenix" } };
    expect(userSchema.safeParse(user).success).toBe(false);
  });
});

describe("toPublicUser / publicUserSchema", () => {
  it("strips every sensitive demo field", () => {
    const projected = toPublicUser(makeUser());
    for (const key of ["password", "ssn", "bank", "ein", "userAgent", "crypto", "ip", "macAddress"]) {
      expect(projected).not.toHaveProperty(key);
    }
  });

  it("preserves the safe presentation fields", () => {
    const projected = toPublicUser(makeUser());
    expect(projected.id).toBe(1);
    expect(projected.firstName).toBe("Emily");
    expect(projected.email).toBe("emily.johnson@x.dummyjson.com");
    expect(projected.address.city).toBe("Phoenix");
  });

  it("produces output that re-validates against the public schema", () => {
    expect(publicUserSchema.safeParse(toPublicUser(makeUser())).success).toBe(true);
  });
});

describe("userListResponseSchema", () => {
  it("accepts a wrapped user list", () => {
    const payload = { users: [makeUser()], total: 208, skip: 0, limit: 10 };
    expect(userListResponseSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a bare user array", () => {
    expect(userListResponseSchema.safeParse([makeUser()]).success).toBe(false);
  });
});

describe("cartSchema", () => {
  it("accepts a verified cart payload", () => {
    expect(cartSchema.safeParse(makeCart()).success).toBe(true);
  });

  it("rejects a cart item missing required fields", () => {
    const cart = { ...makeCart(), products: [{ id: 1, title: "x" }] };
    expect(cartSchema.safeParse(cart).success).toBe(false);
  });

  it("validates a wrapped cart list", () => {
    const payload = { carts: [makeCart()], total: 50, skip: 0, limit: 10 };
    expect(cartListResponseSchema.safeParse(payload).success).toBe(true);
  });
});

describe("auth schemas", () => {
  it("accepts a verified auth session payload", () => {
    expect(authSessionSchema.safeParse(makeAuthSession()).success).toBe(true);
  });

  it("rejects a session missing the access token", () => {
    const session = { ...makeAuthSession() } as Record<string, unknown>;
    delete session.accessToken;
    expect(authSessionSchema.safeParse(session).success).toBe(false);
  });

  it("requires non-empty credentials on login", () => {
    expect(loginRequestSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ username: "emilys", password: "emilyspass" }).success).toBe(true);
  });

  it("validates the optional positive expiresInMins", () => {
    expect(loginRequestSchema.safeParse({ username: "a", password: "b", expiresInMins: 60 }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ username: "a", password: "b", expiresInMins: -1 }).success).toBe(false);
  });
});
