import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductInfo } from "@/features/storefront/product-detail/product-info";
import type { Product } from "@/lib/api/schemas";

/**
 * The nested AddToCart reads persisted stores and gates on hydration. These
 * tests target ProductInfo's presentation (price/discount/rating/availability),
 * so the child is stubbed to keep the unit isolated.
 */
vi.mock("@/features/storefront/product-detail/add-to-cart", async () => {
  const React = await import("react");
  return {
    AddToCart: () => React.createElement("div", { "data-testid": "add-to-cart" }),
  };
});

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: "Aurora Lamp",
    description: "A warm, dimmable table lamp.",
    category: "home-decoration",
    price: 100,
    discountPercentage: 25,
    rating: 4.5,
    stock: 20,
    tags: ["lamp", "decor"],
    brand: "Meridian",
    sku: "SKU-1",
    weight: 2,
    dimensions: { width: 10, height: 20, depth: 5 },
    warrantyInformation: "1 year warranty",
    shippingInformation: "Ships in 2 days",
    availabilityStatus: "In Stock",
    reviews: [],
    returnPolicy: "30 day returns",
    minimumOrderQuantity: 1,
    images: ["https://cdn.dummyjson.com/products/images/1.png"],
    thumbnail: "https://cdn.dummyjson.com/products/images/1.png",
    ...overrides,
  };
}

describe("ProductInfo", () => {
  it("renders core identity fields from the product", () => {
    render(<ProductInfo product={makeProduct()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Aurora Lamp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("home decoration")).toBeInTheDocument();
    expect(screen.getByText("Meridian")).toBeInTheDocument();
    expect(
      screen.getByText("A warm, dimmable table lamp."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("add-to-cart")).toBeInTheDocument();
  });

  it("renders discounted and original price via domain money helpers", () => {
    render(<ProductInfo product={makeProduct()} />);

    expect(screen.getByText("$75.00")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("-25% off")).toBeInTheDocument();
  });

  it("omits sale affordances when there is no discount", () => {
    render(
      <ProductInfo product={makeProduct({ discountPercentage: 0 })} />,
    );

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.queryByText("$75.00")).not.toBeInTheDocument();
    expect(screen.queryByText(/-\d+% off/)).not.toBeInTheDocument();
  });

  it("clamps the rating to the 0-5 range for display", () => {
    render(<ProductInfo product={makeProduct({ rating: 7.9 })} />);

    expect(screen.getByLabelText("Rated 5.0 out of 5")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rated 7.9 out of 5")).not.toBeInTheDocument();
  });

  it("shows the low-stock status derived from inventory helpers", () => {
    render(<ProductInfo product={makeProduct({ stock: 3 })} />);
    expect(screen.getByText("Low stock")).toBeInTheDocument();
  });

  it("shows the out-of-stock status when stock is depleted", () => {
    render(<ProductInfo product={makeProduct({ stock: 0 })} />);
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("reports the review count next to the rating", () => {
    render(
      <ProductInfo
        product={makeProduct({
          reviews: [
            {
              rating: 5,
              comment: "Great",
              date: "2024-01-01T00:00:00.000Z",
              reviewerName: "A",
              reviewerEmail: "a@example.com",
            },
            {
              rating: 4,
              comment: "Good",
              date: "2024-01-02T00:00:00.000Z",
              reviewerName: "B",
              reviewerEmail: "b@example.com",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("(2 reviews)")).toBeInTheDocument();
  });

  it("renders the spec grid and tags", () => {
    render(<ProductInfo product={makeProduct()} />);

    expect(screen.getByText("SKU-1")).toBeInTheDocument();
    expect(screen.getByText("2 kg")).toBeInTheDocument();
    expect(screen.getByText("10 × 20 × 5 cm")).toBeInTheDocument();
    expect(screen.getByText("30 day returns")).toBeInTheDocument();
    expect(screen.getByText("Ships in 2 days")).toBeInTheDocument();
    expect(screen.getByText("1 year warranty")).toBeInTheDocument();
    expect(screen.getByText("lamp")).toBeInTheDocument();
    expect(screen.getByText("decor")).toBeInTheDocument();
  });
});
