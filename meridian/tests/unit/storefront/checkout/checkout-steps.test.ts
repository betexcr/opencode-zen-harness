import { describe, expect, it } from "vitest";

import {
  CHECKOUT_STEPS,
  CHECKOUT_STEP_FIELDS,
  CHECKOUT_STEP_ORDER,
  CHECKOUT_STEP_SCHEMAS,
  FINAL_CHECKOUT_STEP,
  FIRST_CHECKOUT_STEP,
  checkoutStepFields,
  checkoutStepPosition,
  isCheckoutStepId,
  isInputStep,
  nextCheckoutStep,
  previousCheckoutStep,
  stepDefinition,
} from "@/features/storefront/checkout/checkout-steps";
import {
  checkoutContactSchema,
  checkoutShippingSchema,
  demoPaymentSchema,
} from "@/lib/validation/checkout";

const VALID_CONTACT = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  phone: "+1 555 123 4567",
};

const VALID_SHIPPING = {
  fullName: "Jane Doe",
  line1: "10 Market Street",
  line2: "",
  city: "Springfield",
  region: "Illinois",
  postalCode: "62704",
  country: "United States",
};

const VALID_PAYMENT = {
  cardName: "Jane Doe",
  cardNumber: "4242 4242 4242 4242",
  expiry: "12/34",
  cvc: "123",
};

describe("checkout step order", () => {
  it("defines the canonical order", () => {
    expect(CHECKOUT_STEP_ORDER).toEqual([
      "contact",
      "shipping",
      "payment",
      "review",
    ]);
  });

  it("assigns 1-based positions in order", () => {
    expect(CHECKOUT_STEPS.map((step) => step.position)).toEqual([1, 2, 3, 4]);
    expect(CHECKOUT_STEPS.map((step) => step.id)).toEqual([
      ...CHECKOUT_STEP_ORDER,
    ]);
  });

  it("pins the first and final steps", () => {
    expect(FIRST_CHECKOUT_STEP).toBe("contact");
    expect(FINAL_CHECKOUT_STEP).toBe("review");
  });
});

describe("checkout step navigation", () => {
  it("advances in order and stops at the last step", () => {
    expect(nextCheckoutStep("contact")).toBe("shipping");
    expect(nextCheckoutStep("shipping")).toBe("payment");
    expect(nextCheckoutStep("payment")).toBe("review");
    expect(nextCheckoutStep("review")).toBeNull();
  });

  it("retreats in order and stops at the first step", () => {
    expect(previousCheckoutStep("contact")).toBeNull();
    expect(previousCheckoutStep("shipping")).toBe("contact");
    expect(previousCheckoutStep("payment")).toBe("shipping");
    expect(previousCheckoutStep("review")).toBe("payment");
  });

  it("reports 1-based positions", () => {
    expect(checkoutStepPosition("contact")).toBe(1);
    expect(checkoutStepPosition("review")).toBe(4);
  });
});

describe("checkout step identity", () => {
  it("narrows known step ids", () => {
    expect(isCheckoutStepId("shipping")).toBe(true);
    expect(isCheckoutStepId("nope")).toBe(false);
    expect(isCheckoutStepId(undefined)).toBe(false);
  });

  it("treats every step except review as an input step", () => {
    expect(isInputStep("contact")).toBe(true);
    expect(isInputStep("shipping")).toBe(true);
    expect(isInputStep("payment")).toBe(true);
    expect(isInputStep("review")).toBe(false);
  });

  it("returns the full definition for a step", () => {
    const review = stepDefinition("review");
    expect(review).toMatchObject({ id: "review", position: 4, label: "Review" });
    expect(review.description.length).toBeGreaterThan(0);
  });
});

describe("checkout step fields", () => {
  it("maps each input step to only its own fields", () => {
    expect(checkoutStepFields("contact")).toEqual([
      "fullName",
      "email",
      "phone",
    ]);
    expect(checkoutStepFields("shipping")).toEqual([
      "fullName",
      "line1",
      "line2",
      "city",
      "region",
      "postalCode",
      "country",
    ]);
    expect(checkoutStepFields("payment")).toEqual([
      "cardName",
      "cardNumber",
      "expiry",
      "cvc",
    ]);
  });

  it("owns no fields on the review step", () => {
    expect(checkoutStepFields("review")).toEqual([]);
  });

  it("exposes the same lists through the const field map", () => {
    expect(CHECKOUT_STEP_FIELDS.contact).toEqual(checkoutStepFields("contact"));
    expect(CHECKOUT_STEP_FIELDS.shipping).toEqual(
      checkoutStepFields("shipping"),
    );
    expect(CHECKOUT_STEP_FIELDS.payment).toEqual(checkoutStepFields("payment"));
  });
});

describe("checkout step schemas reuse the shared validation module", () => {
  it("exposes the exact schemas from lib/validation/checkout", () => {
    expect(CHECKOUT_STEP_SCHEMAS.contact).toBe(checkoutContactSchema);
    expect(CHECKOUT_STEP_SCHEMAS.shipping).toBe(checkoutShippingSchema);
    expect(CHECKOUT_STEP_SCHEMAS.payment).toBe(demoPaymentSchema);
  });

  it("accepts valid input for every segment", () => {
    expect(checkoutContactSchema.safeParse(VALID_CONTACT).success).toBe(true);
    expect(checkoutShippingSchema.safeParse(VALID_SHIPPING).success).toBe(true);
    expect(demoPaymentSchema.safeParse(VALID_PAYMENT).success).toBe(true);
  });

  it("rejects invalid input for every segment", () => {
    expect(
      checkoutContactSchema.safeParse({ ...VALID_CONTACT, email: "nope" })
        .success,
    ).toBe(false);
    expect(
      checkoutShippingSchema.safeParse({ ...VALID_SHIPPING, line1: "" })
        .success,
    ).toBe(false);
    expect(
      demoPaymentSchema.safeParse({ ...VALID_PAYMENT, cardNumber: "1234" })
        .success,
    ).toBe(false);
  });
});
