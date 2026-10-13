"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CreditCardIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import {
  useForm,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { checkoutActions } from "@/features/storefront/checkout/checkout-actions";
import {
  CHECKOUT_STEPS,
  FINAL_CHECKOUT_STEP,
  FIRST_CHECKOUT_STEP,
  checkoutStepFields,
  isInputStep,
  nextCheckoutStep,
  previousCheckoutStep,
  stepDefinition,
  type CheckoutStepId,
} from "@/features/storefront/checkout/checkout-steps";
import {
  OrderConfirmation,
  type PlacedOrder,
} from "@/features/storefront/checkout/order-confirmation";
import { estimateOrderTotals, type OrderEstimate } from "@/lib/domain/cart";
import { formatCurrency } from "@/lib/domain/money";
import { selectCartLines, useCartStore } from "@/lib/state";
import { cn } from "@/lib/utils";
import {
  DEMO_PAYMENT_DISCLAIMER,
  checkoutContactDefaults,
  checkoutSchema,
  checkoutShippingDefaults,
  demoPaymentDefaults,
  type CheckoutInput,
  type CheckoutValues,
} from "@/lib/validation/checkout";

/**
 * Multi-step checkout wizard.
 *
 * A client component driven by React Hook Form + `zodResolver` against the
 * shared schemas in `lib/validation/checkout.ts`. Each input step is validated
 * against only its own fields (`checkoutStepFields`) before the shopper may
 * advance, and the final review step recaps everything entered. Submitting
 * delegates to `checkoutActions.placeOrder`, which builds an immutable order
 * snapshot, persists it through the orders store, and clears the cart (and
 * no-ops when the cart is empty). No network call to any payment provider is
 * ever made — the payment step is a UI demonstration over the DEMO card schema.
 */

export interface CheckoutWizardProps {
  /**
   * Called once an order has been persisted, with its assigned order number.
   * The route uses it to keep the confirmation on screen when the now-empty
   * cart would otherwise trigger the empty-cart redirect.
   */
  onOrderPlaced?: (orderNumber: number) => void;
}

/** Combined defaults for every field in the merged checkout schema. */
const CHECKOUT_DEFAULTS: CheckoutInput = {
  ...checkoutContactDefaults,
  ...checkoutShippingDefaults,
  ...demoPaymentDefaults,
};

/** Props shared by the per-step field groups. */
interface FieldSetProps {
  register: UseFormRegister<CheckoutInput>;
  errors: FieldErrors<CheckoutInput>;
}

function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\s+/g, "");
  if (digits.length === 0) return "—";
  if (digits.length <= 4) return digits;
  return `•••• •••• •••• ${digits.slice(-4)}`;
}

function Field({
  id,
  label,
  error,
  optional = false,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">
            Optional
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function ContactFields({ register, errors }: FieldSetProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        id="checkout-fullName"
        label="Full name"
        error={errors.fullName?.message}
        className="sm:col-span-2"
      >
        <Input
          id="checkout-fullName"
          autoComplete="name"
          {...register("fullName")}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={
            errors.fullName ? "checkout-fullName-error" : undefined
          }
        />
      </Field>
      <Field id="checkout-email" label="Email" error={errors.email?.message}>
        <Input
          id="checkout-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "checkout-email-error" : undefined}
        />
      </Field>
      <Field id="checkout-phone" label="Phone" error={errors.phone?.message}>
        <Input
          id="checkout-phone"
          type="tel"
          autoComplete="tel"
          {...register("phone")}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "checkout-phone-error" : undefined}
        />
      </Field>
    </div>
  );
}

function ShippingFields({ register, errors }: FieldSetProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        id="checkout-ship-name"
        label="Recipient name"
        error={errors.fullName?.message}
        className="sm:col-span-2"
      >
        <Input
          id="checkout-ship-name"
          autoComplete="name"
          {...register("fullName")}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={
            errors.fullName ? "checkout-ship-name-error" : undefined
          }
        />
      </Field>
      <Field
        id="checkout-line1"
        label="Street address"
        error={errors.line1?.message}
        className="sm:col-span-2"
      >
        <Input
          id="checkout-line1"
          autoComplete="address-line1"
          {...register("line1")}
          aria-invalid={Boolean(errors.line1)}
          aria-describedby={errors.line1 ? "checkout-line1-error" : undefined}
        />
      </Field>
      <Field
        id="checkout-line2"
        label="Address line 2"
        optional
        error={errors.line2?.message}
        className="sm:col-span-2"
      >
        <Input
          id="checkout-line2"
          autoComplete="address-line2"
          {...register("line2")}
          aria-invalid={Boolean(errors.line2)}
          aria-describedby={errors.line2 ? "checkout-line2-error" : undefined}
        />
      </Field>
      <Field id="checkout-city" label="City" error={errors.city?.message}>
        <Input
          id="checkout-city"
          autoComplete="address-level2"
          {...register("city")}
          aria-invalid={Boolean(errors.city)}
          aria-describedby={errors.city ? "checkout-city-error" : undefined}
        />
      </Field>
      <Field
        id="checkout-region"
        label="State or region"
        error={errors.region?.message}
      >
        <Input
          id="checkout-region"
          autoComplete="address-level1"
          {...register("region")}
          aria-invalid={Boolean(errors.region)}
          aria-describedby={errors.region ? "checkout-region-error" : undefined}
        />
      </Field>
      <Field
        id="checkout-postalCode"
        label="Postal code"
        error={errors.postalCode?.message}
      >
        <Input
          id="checkout-postalCode"
          autoComplete="postal-code"
          {...register("postalCode")}
          aria-invalid={Boolean(errors.postalCode)}
          aria-describedby={
            errors.postalCode ? "checkout-postalCode-error" : undefined
          }
        />
      </Field>
      <Field
        id="checkout-country"
        label="Country"
        error={errors.country?.message}
      >
        <Input
          id="checkout-country"
          autoComplete="country-name"
          {...register("country")}
          aria-invalid={Boolean(errors.country)}
          aria-describedby={errors.country ? "checkout-country-error" : undefined}
        />
      </Field>
    </div>
  );
}

function PaymentFields({ register, errors }: FieldSetProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning-muted-foreground">
        {DEMO_PAYMENT_DISCLAIMER}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="checkout-cardName"
          label="Name on card"
          error={errors.cardName?.message}
          className="sm:col-span-2"
        >
          <Input
            id="checkout-cardName"
            autoComplete="cc-name"
            {...register("cardName")}
            aria-invalid={Boolean(errors.cardName)}
            aria-describedby={
              errors.cardName ? "checkout-cardName-error" : undefined
            }
          />
        </Field>
        <Field
          id="checkout-cardNumber"
          label="Card number"
          error={errors.cardNumber?.message}
          className="sm:col-span-2"
        >
          <Input
            id="checkout-cardNumber"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            {...register("cardNumber")}
            aria-invalid={Boolean(errors.cardNumber)}
            aria-describedby={
              errors.cardNumber ? "checkout-cardNumber-error" : undefined
            }
          />
        </Field>
        <Field id="checkout-expiry" label="Expiry" error={errors.expiry?.message}>
          <Input
            id="checkout-expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            {...register("expiry")}
            aria-invalid={Boolean(errors.expiry)}
            aria-describedby={errors.expiry ? "checkout-expiry-error" : undefined}
          />
        </Field>
        <Field id="checkout-cvc" label="CVC" error={errors.cvc?.message}>
          <Input
            id="checkout-cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            {...register("cvc")}
            aria-invalid={Boolean(errors.cvc)}
            aria-describedby={errors.cvc ? "checkout-cvc-error" : undefined}
          />
        </Field>
      </div>
    </div>
  );
}

function ReviewRecap({ values }: { values: CheckoutInput }) {
  const address = [
    values.line1,
    values.line2,
    [values.city, values.region].filter(Boolean).join(", "),
    [values.postalCode, values.country].filter(Boolean).join(" "),
  ].filter(
    (line): line is string =>
      typeof line === "string" && line.trim().length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <UserIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Contact
        </h3>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <RecapRow label="Name" value={values.fullName || "—"} />
          <RecapRow label="Email" value={values.email || "—"} />
          <RecapRow label="Phone" value={values.phone || "—"} />
        </dl>
      </section>

      <Separator />

      <section>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <MapPinIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Ship to
        </h3>
        <address className="mt-2 text-sm not-italic text-muted-foreground">
          {address.length > 0 ? (
            address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))
          ) : (
            <span>—</span>
          )}
        </address>
      </section>

      <Separator />

      <section>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <CreditCardIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Payment
        </h3>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <RecapRow label="Name on card" value={values.cardName || "—"} />
          <RecapRow
            label="Card number"
            value={maskCardNumber(values.cardNumber)}
          />
          <RecapRow label="Expiry" value={values.expiry || "—"} />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {DEMO_PAYMENT_DISCLAIMER} The CVC is never stored.
        </p>
      </section>
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: CheckoutStepId }) {
  const currentPosition = stepDefinition(currentStep).position;

  return (
    <ol
      aria-label="Checkout steps"
      className="flex flex-wrap items-center gap-x-2 gap-y-3"
    >
      {CHECKOUT_STEPS.map((step) => {
        const isComplete = step.position < currentPosition;
        const isCurrent = step.position === currentPosition;
        return (
          <li
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                isCurrent &&
                  "border-accent-brand bg-accent-brand text-accent-brand-foreground",
                isComplete &&
                  "border-success/40 bg-success-muted text-success-muted-foreground",
                !isCurrent &&
                  !isComplete &&
                  "border-border text-muted-foreground",
              )}
            >
              {isComplete ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                step.position
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {step.position < CHECKOUT_STEPS.length ? (
              <Separator
                orientation="vertical"
                className="mx-1 hidden h-4 sm:block"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function OrderRecap({ estimate }: { estimate: OrderEstimate }) {
  const shippingLabel =
    estimate.shippingCents === 0
      ? "Free"
      : formatCurrency(estimate.shippingCents);

  return (
    <aside
      aria-labelledby="checkout-summary-heading"
      className="h-fit rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id="checkout-summary-heading"
        className="font-heading text-lg font-semibold"
      >
        Order summary
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {estimate.itemCount} {estimate.itemCount === 1 ? "unit" : "units"}
      </p>

      <dl className="mt-6 flex flex-col gap-3">
        <RecapRow
          label="Subtotal"
          value={formatCurrency(estimate.subtotalCents)}
        />
        {estimate.discountCents > 0 ? (
          <RecapRow
            label="Discount"
            value={`-${formatCurrency(estimate.discountCents)}`}
          />
        ) : null}
        <RecapRow label="Shipping (estimated)" value={shippingLabel} />
        <RecapRow
          label={`Tax (estimated, ${estimate.taxRatePercent}%)`}
          value={formatCurrency(estimate.taxCents)}
        />
        <Separator className="my-1" />
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-heading text-base font-semibold">Total</dt>
          <dd className="font-heading text-base font-semibold tabular-nums">
            {formatCurrency(estimate.totalCents)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Shipping and tax are demonstration estimates, not real carrier rates or
        tax law.
      </p>
    </aside>
  );
}

export function CheckoutWizard({ onOrderPlaced }: CheckoutWizardProps) {
  const lines = useCartStore(selectCartLines);

  const [step, setStep] = useState<CheckoutStepId>(FIRST_CHECKOUT_STEP);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: CHECKOUT_DEFAULTS,
    mode: "onTouched",
  });

  const estimate = estimateOrderTotals(lines);

  const handlePlaceOrder = handleSubmit((values) => {
    const placed = checkoutActions.placeOrder({
      lines: useCartStore.getState().lines,
      values,
      placedAt: new Date().toISOString(),
    });
    if (!placed) return;
    setPlacedOrder({
      number: placed.number,
      recipient: placed.snapshot.contact.fullName,
      totalCents: placed.snapshot.estimate.totalCents,
    });
    onOrderPlaced?.(placed.number);
  });

  async function goToNextStep() {
    if (isInputStep(step)) {
      const valid = await trigger([...checkoutStepFields(step)], {
        shouldFocus: true,
      });
      if (!valid) return;
    }
    const next = nextCheckoutStep(step);
    if (next) setStep(next);
  }

  function goToPreviousStep() {
    const previous = previousCheckoutStep(step);
    if (previous) setStep(previous);
  }

  function handleSubmitAttempt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === FINAL_CHECKOUT_STEP) {
      void handlePlaceOrder();
      return;
    }
    void goToNextStep();
  }

  if (placedOrder) {
    return <OrderConfirmation order={placedOrder} />;
  }

  const current = stepDefinition(step);
  const previous = previousCheckoutStep(step);
  const values = getValues();

  return (
    <div className="mt-10">
      <Stepper currentStep={step} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          noValidate
          onSubmit={handleSubmitAttempt}
          className="rounded-xl border border-border bg-surface p-6"
        >
          <h2 className="font-heading text-xl font-semibold">
            {current.label}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {current.description}
          </p>

          <div className="mt-6">
            {step === "contact" ? (
              <ContactFields register={register} errors={errors} />
            ) : null}
            {step === "shipping" ? (
              <ShippingFields register={register} errors={errors} />
            ) : null}
            {step === "payment" ? (
              <PaymentFields register={register} errors={errors} />
            ) : null}
            {step === "review" ? <ReviewRecap values={values} /> : null}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {previous ? (
              <Button
                type="button"
                variant="ghost"
                onClick={goToPreviousStep}
                disabled={isSubmitting}
              >
                <ArrowLeftIcon aria-hidden="true" />
                Back
              </Button>
            ) : (
              <Link
                href="/cart"
                className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5")}
              >
                <ArrowLeftIcon aria-hidden="true" />
                Back to cart
              </Link>
            )}

            {step === FINAL_CHECKOUT_STEP ? (
              <Button type="submit" size="lg" disabled={isSubmitting}>
                <ShieldCheckIcon aria-hidden="true" />
                {isSubmitting ? "Placing order…" : "Place demo order"}
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={isSubmitting}>
                Continue
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            )}
          </div>
        </form>

        <OrderRecap estimate={estimate} />
      </div>
    </div>
  );
}
