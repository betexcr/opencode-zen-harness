import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductReviews } from "@/features/storefront/product-detail/product-reviews";
import type { ProductReview } from "@/lib/api/schemas";

const REVIEW_1: ProductReview = {
  rating: 5,
  comment: "Excellent build quality and fast shipping.",
  date: "2024-01-15T10:30:00.000Z",
  reviewerName: "Alex Johnson",
  reviewerEmail: "alex.j@example.com",
};

const REVIEW_2: ProductReview = {
  rating: 3,
  comment: "It's okay, but the color was slightly different than expected.",
  date: "2024-02-03T14:00:00.000Z",
  reviewerName: "Taylor R.",
  reviewerEmail: "taylor.r@example.com",
};

describe("ProductReviews", () => {
  it("renders empty state when there are no reviews", () => {
    render(<ProductReviews reviews={[]} />);
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Customer Reviews/)).not.toBeInTheDocument();
  });

  it("renders review count and review details with stars", () => {
    render(<ProductReviews reviews={[REVIEW_1, REVIEW_2]} />);

    expect(screen.getByText("Customer Reviews (2)")).toBeInTheDocument();
    expect(screen.getByText("Alex Johnson")).toBeInTheDocument();
    expect(screen.getByText("alex.j@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("Excellent build quality and fast shipping."),
    ).toBeInTheDocument();
    expect(screen.getByText("Taylor R.")).toBeInTheDocument();
    expect(
      screen.getByText("It's okay, but the color was slightly different than expected."),
    ).toBeInTheDocument();

    expect(
      screen.getByText(new Date(REVIEW_1.date).toLocaleDateString()),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new Date(REVIEW_2.date).toLocaleDateString()),
    ).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ProductReviews reviews={[]} className="mt-8" />,
    );
    const empty = container.querySelector(".mt-8");
    expect(empty).toBeInTheDocument();
  });
});
