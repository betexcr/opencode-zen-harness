import type { ZodType } from "zod";

import {
  checkoutContactSchema,
  checkoutShippingSchema,
  demoPaymentSchema,
  type CheckoutInput,
} from "@/lib/validation/checkout";

/**
 * Checkout wizard step metadata.
 *
 * Pure data and helpers for the multi-step checkout: the ordered step list, the
 * subset of steps that collect input, and the map from each input step to the
 * schema in `lib/validation/checkout.ts` that guards it. The schemas are reused
 * here — never redefined — so the wizard and every other checkout surface
 * validate against exactly the same rules.
 *
 * The final "review" step is a recap with no schema of its own; the whole form
 * is still validated by the merged `checkoutSchema` on submit.
 */

export type CheckoutStepId = "contact" | "shipping" | "payment" | "review";

export interface CheckoutStepDefinition {
  id: CheckoutStepId;
  /** Short label for the stepper. */
  label: string;
  /** Sentence describing what the step collects. */
  description: string;
  /** 1-based position in the wizard, used for the stepper marker. */
  position: number;
}

/** Steps that collect input (everything except the recap). */
export type CheckoutInputStepId = Exclude<CheckoutStepId, "review">;

/** The canonical step order. */
export const CHECKOUT_STEP_ORDER = [
  "contact",
  "shipping",
  "payment",
  "review",
] as const satisfies readonly CheckoutStepId[];

const STEP_COPY: Record<
  CheckoutStepId,
  Omit<CheckoutStepDefinition, "position">
> = {
  contact: {
    id: "contact",
    label: "Contact",
    description: "How we can reach you about this demo order.",
  },
  shipping: {
    id: "shipping",
    label: "Shipping",
    description: "Where the order should be sent.",
  },
  payment: {
    id: "payment",
    label: "Payment",
    description: "Demo card details. Nothing is charged or transmitted.",
  },
  review: {
    id: "review",
    label: "Review",
    description: "Confirm the details below, then place the order.",
  },
};

/** Ordered step definitions with their 1-based position. */
export const CHECKOUT_STEPS: readonly CheckoutStepDefinition[] =
  CHECKOUT_STEP_ORDER.map((id, index) => ({
    ...STEP_COPY[id],
    position: index + 1,
  }));

export const FIRST_CHECKOUT_STEP: CheckoutStepId = "contact";
export const FINAL_CHECKOUT_STEP: CheckoutStepId = "review";

/**
 * The schema that guards each input step. These are the shared
 * `lib/validation/checkout.ts` schemas, so a rule change never has to be made in
 * two places.
 */
export const CHECKOUT_STEP_SCHEMAS = {
  contact: checkoutContactSchema,
  shipping: checkoutShippingSchema,
  payment: demoPaymentSchema,
} as const satisfies Record<CheckoutInputStepId, ZodType>;

/**
 * Form fields owned by each input step. The wizard validates only these fields
 * before allowing a shopper to advance, so an untouched step cannot block the
 * current one.
 */
export const CHECKOUT_STEP_FIELDS = {
  contact: ["fullName", "email", "phone"],
  shipping: [
    "fullName",
    "line1",
    "line2",
    "city",
    "region",
    "postalCode",
    "country",
  ],
  payment: ["cardName", "cardNumber", "expiry", "cvc"],
} as const satisfies Record<CheckoutInputStepId, readonly (keyof CheckoutInput)[]>;

/** Narrow an unknown value to a known step id. */
export function isCheckoutStepId(value: unknown): value is CheckoutStepId {
  return CHECKOUT_STEP_ORDER.some((step) => step === value);
}

/** Narrow to an input step (a step that is validated by a schema). */
export function isInputStep(id: CheckoutStepId): id is CheckoutInputStepId {
  return id !== FINAL_CHECKOUT_STEP;
}

/** 1-based position of a step in {@link CHECKOUT_STEP_ORDER}. */
export function checkoutStepPosition(id: CheckoutStepId): number {
  return CHECKOUT_STEP_ORDER.indexOf(id) + 1;
}

/** The full definition for a step. */
export function stepDefinition(id: CheckoutStepId): CheckoutStepDefinition {
  return CHECKOUT_STEPS[checkoutStepPosition(id) - 1];
}

/** The next step, or `null` when the given step is the last. */
export function nextCheckoutStep(id: CheckoutStepId): CheckoutStepId | null {
  const index = CHECKOUT_STEP_ORDER.indexOf(id);
  return CHECKOUT_STEP_ORDER[index + 1] ?? null;
}

/** The previous step, or `null` when the given step is the first. */
export function previousCheckoutStep(id: CheckoutStepId): CheckoutStepId | null {
  const index = CHECKOUT_STEP_ORDER.indexOf(id);
  return index > 0 ? CHECKOUT_STEP_ORDER[index - 1] : null;
}

/**
 * The form fields the given step validates. The recap step owns no fields, so
 * it returns an empty list and advancing from it is not field-gated.
 */
export function checkoutStepFields(
  id: CheckoutStepId,
): readonly (keyof CheckoutInput)[] {
  return isInputStep(id) ? CHECKOUT_STEP_FIELDS[id] : [];
}
