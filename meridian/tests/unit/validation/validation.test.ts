import { describe, expect, it } from "vitest";
import {
  checkoutContactDefaults,
  checkoutContactSchema,
  checkoutShippingDefaults,
  checkoutShippingSchema,
  demoPaymentDefaults,
  demoPaymentSchema,
  parseImageList,
  parseTagList,
  productEditorSchema,
  PRODUCT_IMAGE_LIMIT,
} from "@/lib/validation";

describe("productEditorSchema", () => {
  const valid = {
    title: "Warm Wool Coat",
    description: "A structured wool coat for cold meridian mornings.",
    category: "mens-shirts",
    brand: "Meridian",
    price: 189.5,
    discountPercentage: 10,
    stock: 24,
    minimumOrderQuantity: 1,
    images: ["https://cdn.dummyjson.com/product-images/1/1.webp"],
    tags: ["wool", "outerwear"],
  };

  it("accepts a fully valid product", () => {
    const result = productEditorSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("coerces numeric strings for numeric fields", () => {
    const result = productEditorSchema.safeParse({
      ...valid,
      price: "189.50",
      stock: "24",
      discountPercentage: "10",
      minimumOrderQuantity: "1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBeCloseTo(189.5);
      expect(result.data.stock).toBe(24);
      expect(result.data.minimumOrderQuantity).toBe(1);
    }
  });

  it("trims text fields", () => {
    const result = productEditorSchema.safeParse({
      ...valid,
      title: "  Warm Wool Coat  ",
      brand: "  Meridian  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Warm Wool Coat");
      expect(result.data.brand).toBe("Meridian");
    }
  });

  it("rejects a too-short title", () => {
    const result = productEditorSchema.safeParse({ ...valid, title: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty description", () => {
    const result = productEditorSchema.safeParse({ ...valid, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a zero price", () => {
    const result = productEditorSchema.safeParse({ ...valid, price: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a discount above 100", () => {
    const result = productEditorSchema.safeParse({
      ...valid,
      discountPercentage: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer stock value", () => {
    const result = productEditorSchema.safeParse({ ...valid, stock: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a minimum order quantity below 1", () => {
    const result = productEditorSchema.safeParse({
      ...valid,
      minimumOrderQuantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty image list", () => {
    const result = productEditorSchema.safeParse({ ...valid, images: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than the image limit", () => {
    const images = Array.from(
      { length: PRODUCT_IMAGE_LIMIT + 1 },
      (_, index) => `https://cdn.dummyjson.com/product-images/1/${index}.webp`,
    );
    const result = productEditorSchema.safeParse({ ...valid, images });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed image URL", () => {
    const result = productEditorSchema.safeParse({
      ...valid,
      images: ["not-a-url"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank tags", () => {
    const result = productEditorSchema.safeParse({ ...valid, tags: [""] });
    expect(result.success).toBe(false);
  });
});

describe("parseTagList and parseImageList", () => {
  it("splits, trims, and drops empty tags", () => {
    expect(parseTagList(" wool, outerwear , , cotton ")).toEqual([
      "wool",
      "outerwear",
      "cotton",
    ]);
  });

  it("splits images on commas and newlines", () => {
    expect(
      parseImageList(
        "https://cdn.dummyjson.com/a.webp,\n https://cdn.dummyjson.com/b.webp ",
      ),
    ).toEqual([
      "https://cdn.dummyjson.com/a.webp",
      "https://cdn.dummyjson.com/b.webp",
    ]);
  });
});

describe("checkoutContactSchema", () => {
  it("accepts valid contact details", () => {
    const result = checkoutContactSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@meridian.test",
      phone: "+1 (555) 010-2030",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = checkoutContactSchema.safeParse({
      ...checkoutContactDefaults,
      fullName: "Ada Lovelace",
      email: "not-an-email",
      phone: "5550102030",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone with invalid characters", () => {
    const result = checkoutContactSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@meridian.test",
      phone: "call-me",
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutShippingSchema", () => {
  it("accepts a valid shipping address and optional line2", () => {
    const result = checkoutShippingSchema.safeParse({
      fullName: "Ada Lovelace",
      line1: "12 Meridian Row",
      city: "London",
      region: "Greater London",
      postalCode: "EC1A-1BB",
      country: "United Kingdom",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short street address", () => {
    const result = checkoutShippingSchema.safeParse({
      ...checkoutShippingDefaults,
      line1: "12",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a postal code with invalid characters", () => {
    const result = checkoutShippingSchema.safeParse({
      fullName: "Ada Lovelace",
      line1: "12 Meridian Row",
      city: "London",
      region: "Greater London",
      postalCode: "@@@",
      country: "United Kingdom",
    });
    expect(result.success).toBe(false);
  });
});

describe("demoPaymentSchema", () => {
  it("accepts the documented demo card and normalizes spacing", () => {
    const result = demoPaymentSchema.safeParse({
      cardName: "Ada Lovelace",
      cardNumber: "4242 4242 4242 4242",
      expiry: "12/30",
      cvc: "123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cardNumber).toBe("4242424242424242");
    }
  });

  it("rejects a non-demo card number", () => {
    const result = demoPaymentSchema.safeParse({
      ...demoPaymentDefaults,
      cardName: "Ada Lovelace",
      cardNumber: "1234",
      expiry: "12/30",
      cvc: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed expiry", () => {
    const result = demoPaymentSchema.safeParse({
      cardName: "Ada Lovelace",
      cardNumber: "4242424242424242",
      expiry: "2030-12",
      cvc: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed CVC", () => {
    const result = demoPaymentSchema.safeParse({
      cardName: "Ada Lovelace",
      cardNumber: "4242424242424242",
      expiry: "12/30",
      cvc: "ab",
    });
    expect(result.success).toBe(false);
  });
});
