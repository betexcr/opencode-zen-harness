import { z } from "zod";

/**
 * Shared, reusable field schemas for the multi-step checkout flow.
 *
 * Every top-level schema here is a plain Zod object so it can be handed
 * directly to React Hook Form via `zodResolver` without refine-only types
 * breaking the resolver. All string fields are trimmed and validated with
 * human-readable messages.
 */

export const checkoutNameSchema = z
  .string({
    required_error: "Enter a name.",
    invalid_type_error: "Name must be text.",
  })
  .trim()
  .min(2, { message: "Name must be at least 2 characters." })
  .max(80, { message: "Name must be 80 characters or fewer." });

export const checkoutEmailSchema = z
  .string({
    required_error: "Enter an email address.",
    invalid_type_error: "Email must be text.",
  })
  .trim()
  .min(1, { message: "Enter an email address." })
  .email({ message: "Enter a valid email address." })
  .max(160, { message: "Email must be 160 characters or fewer." });

export const checkoutPhoneSchema = z
  .string({
    required_error: "Enter a phone number.",
    invalid_type_error: "Phone number must be text.",
  })
  .trim()
  .min(7, { message: "Enter a valid phone number." })
  .max(24, { message: "Phone number is too long." })
  .regex(/^[0-9+()\-\s.]+$/, {
    message: "Phone number contains invalid characters.",
  });

export const checkoutLine1Schema = z
  .string({
    required_error: "Enter a street address.",
    invalid_type_error: "Street address must be text.",
  })
  .trim()
  .min(3, { message: "Street address must be at least 3 characters." })
  .max(120, { message: "Street address must be 120 characters or fewer." });

export const checkoutLine2Schema = z
  .string({ invalid_type_error: "Address line 2 must be text." })
  .trim()
  .max(120, { message: "Address line 2 must be 120 characters or fewer." })
  .optional();

export const checkoutCitySchema = z
  .string({
    required_error: "Enter a city.",
    invalid_type_error: "City must be text.",
  })
  .trim()
  .min(2, { message: "Enter a city." })
  .max(80, { message: "City must be 80 characters or fewer." });

export const checkoutRegionSchema = z
  .string({
    required_error: "Enter a state or region.",
    invalid_type_error: "Region must be text.",
  })
  .trim()
  .min(2, { message: "Enter a state or region." })
  .max(80, { message: "Region must be 80 characters or fewer." });

export const checkoutPostalCodeSchema = z
  .string({
    required_error: "Enter a postal code.",
    invalid_type_error: "Postal code must be text.",
  })
  .trim()
  .min(3, { message: "Enter a valid postal code." })
  .max(12, { message: "Postal code is too long." })
  .regex(/^[A-Za-z0-9][A-Za-z0-9\-\s]*$/, {
    message: "Postal code contains invalid characters.",
  });

export const checkoutCountrySchema = z
  .string({
    required_error: "Choose a country.",
    invalid_type_error: "Country must be text.",
  })
  .trim()
  .min(2, { message: "Choose a country." })
  .max(56, { message: "Country name is too long." });

export const checkoutContactSchema = z.object({
  fullName: checkoutNameSchema,
  email: checkoutEmailSchema,
  phone: checkoutPhoneSchema,
});

export type CheckoutContactValues = z.infer<typeof checkoutContactSchema>;

export const checkoutContactDefaults: CheckoutContactValues = {
  fullName: "",
  email: "",
  phone: "",
};

export const checkoutShippingSchema = z.object({
  fullName: checkoutNameSchema,
  line1: checkoutLine1Schema,
  line2: checkoutLine2Schema,
  city: checkoutCitySchema,
  region: checkoutRegionSchema,
  postalCode: checkoutPostalCodeSchema,
  country: checkoutCountrySchema,
});

export type CheckoutShippingValues = z.infer<typeof checkoutShippingSchema>;

export const checkoutShippingDefaults: CheckoutShippingValues = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

/**
 * DEMO ONLY — payment placeholder.
 *
 * DummyJSON has no payment backend and Meridian performs NO real card
 * processing. These fields exist solely to demonstrate a checkout step UI.
 * The `cardNumber` rule matches a well-known test token only; it is never
 * transmitted anywhere. Do not treat this as production payment validation.
 */
export const DEMO_PAYMENT_DISCLAIMER =
  "Demo only — no real card is charged and no card data leaves this browser session.";

export const demoPaymentCardNameSchema = z
  .string({
    required_error: "Enter the name on the card.",
    invalid_type_error: "Name on card must be text.",
  })
  .trim()
  .min(2, { message: "Name on card must be at least 2 characters." })
  .max(80, { message: "Name on card must be 80 characters or fewer." });

export const demoPaymentCardNumberSchema = z
  .string({
    required_error: "Enter a demo card number.",
    invalid_type_error: "Card number must be text.",
  })
  .trim()
  .transform((value) => value.replace(/\s+/g, ""))
  .refine((value) => /^\d{15,16}$/.test(value), {
    message: "Enter the demo card number 4242 4242 4242 4242.",
  });

export const demoPaymentExpirySchema = z
  .string({
    required_error: "Enter an expiry date.",
    invalid_type_error: "Expiry must be text.",
  })
  .trim()
  .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, {
    message: "Use MM/YY format.",
  });

export const demoPaymentCvcSchema = z
  .string({
    required_error: "Enter a CVC.",
    invalid_type_error: "CVC must be text.",
  })
  .trim()
  .regex(/^\d{3,4}$/, { message: "CVC must be 3 or 4 digits." });

export const demoPaymentSchema = z.object({
  cardName: demoPaymentCardNameSchema,
  cardNumber: demoPaymentCardNumberSchema,
  expiry: demoPaymentExpirySchema,
  cvc: demoPaymentCvcSchema,
});

export type DemoPaymentInput = z.input<typeof demoPaymentSchema>;
export type DemoPaymentValues = z.output<typeof demoPaymentSchema>;

export const demoPaymentDefaults: DemoPaymentInput = {
  cardName: "",
  cardNumber: "",
  expiry: "",
  cvc: "",
};

export const checkoutSchema = checkoutContactSchema
  .merge(checkoutShippingSchema)
  .merge(demoPaymentSchema);

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutValues = z.output<typeof checkoutSchema>;

export const checkoutStepSchemas = {
  contact: checkoutContactSchema,
  shipping: checkoutShippingSchema,
  payment: demoPaymentSchema,
} as const;

export type CheckoutStep = keyof typeof checkoutStepSchemas;
