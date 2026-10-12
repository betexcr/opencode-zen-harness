import { describe, expect, it } from "vitest";

import {
  CENTS_PER_UNIT,
  formatAmount,
  formatCurrency,
  fromCents,
  multiplyCents,
  percentageOfCents,
  roundCents,
  sumCents,
  toCents,
} from "@/lib/domain/money";

describe("money.roundCents", () => {
  it("rounds half away from zero", () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(2.4)).toBe(2);
    expect(roundCents(2.6)).toBe(3);
    expect(roundCents(-2.4)).toBe(-2);
    expect(roundCents(-2.6)).toBe(-3);
  });

  it("returns integers unchanged", () => {
    expect(roundCents(0)).toBe(0);
    expect(roundCents(1999)).toBe(1999);
    expect(roundCents(-1999)).toBe(-1999);
  });

  it("normalizes negative zero to zero", () => {
    expect(Object.is(roundCents(-0), 0)).toBe(true);
    expect(Object.is(roundCents(0), 0)).toBe(true);
  });

  it("throws RangeError on non-finite input", () => {
    expect(() => roundCents(Number.NaN)).toThrow(RangeError);
    expect(() => roundCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => roundCents(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("money.toCents / fromCents", () => {
  it("uses a 100 minor-unit scale", () => {
    expect(CENTS_PER_UNIT).toBe(100);
  });

  it("converts currency units to integer cents", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.2)).toBe(20);
    expect(toCents(0.3)).toBe(30);
    expect(toCents(0)).toBe(0);
    expect(toCents(2.5)).toBe(250);
  });

  it("eliminates binary floating point drift (0.1 + 0.2 === 0.3)", () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
  });

  it("converts cents back to currency units", () => {
    expect(fromCents(1999)).toBe(19.99);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(100)).toBe(1);
  });

  it("round-trips currency-unit amounts for clean values", () => {
    for (const value of [0, 1, 9.99, 19.95, 100, 1234.56]) {
      expect(fromCents(toCents(value))).toBeCloseTo(value, 10);
    }
  });

  it("throws RangeError converting non-finite amounts", () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("money.multiplyCents", () => {
  it("multiplies integer cents and rounds once", () => {
    expect(multiplyCents(1999, 3)).toBe(5997);
    expect(multiplyCents(333, 3)).toBe(999);
    expect(multiplyCents(100, 0)).toBe(0);
  });

  it("rounds half away from zero", () => {
    expect(multiplyCents(101, 1.5)).toBe(152);
    expect(multiplyCents(101, 1.4)).toBe(141);
  });

  it("rounds non-integer cent inputs before multiplying", () => {
    expect(multiplyCents(100.4, 2)).toBe(200);
  });
});

describe("money.percentageOfCents", () => {
  it("computes a percent of a cent amount rounded to whole cents", () => {
    expect(percentageOfCents(1000, 8.25)).toBe(83);
    expect(percentageOfCents(999, 10.48)).toBe(105);
    expect(percentageOfCents(5000, 10)).toBe(500);
    expect(percentageOfCents(2000, 7)).toBe(140);
  });

  it("handles zero and fractional percent values", () => {
    expect(percentageOfCents(1000, 0)).toBe(0);
    expect(percentageOfCents(0, 50)).toBe(0);
    expect(percentageOfCents(333, 50)).toBe(167);
  });
});

describe("money.sumCents", () => {
  it("sums integer cent amounts", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(sumCents([1999, 5000, 999])).toBe(7998);
  });

  it("rounds non-integer inputs before summing", () => {
    expect(sumCents([1.4, 1.4])).toBe(2);
    expect(sumCents([1.6, 1.6])).toBe(4);
  });
});

describe("money.formatCurrency", () => {
  it("formats integer cents as localized USD by default", () => {
    expect(formatCurrency(1999)).toBe("$19.99");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(100)).toBe("$1.00");
    expect(formatCurrency(123456)).toBe("$1,234.56");
  });

  it("honors currency and fraction-digit overrides", () => {
    expect(formatCurrency(1999, { currency: "EUR", locale: "de-DE" })).toContain("19,99");
    expect(formatCurrency(1999, { fractionDigits: 0 })).toBe("$20");
  });
});

describe("money.formatAmount", () => {
  it("formats a currency-unit amount through the integer-cent strategy", () => {
    expect(formatAmount(19.99)).toBe(formatCurrency(1999));
    expect(formatAmount(9.99)).toBe("$9.99");
    expect(formatAmount(0)).toBe("$0.00");
  });
});
