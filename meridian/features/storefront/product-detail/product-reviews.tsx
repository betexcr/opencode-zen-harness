import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductReview } from "@/lib/api/schemas";

export interface ProductReviewsProps {
  reviews: readonly ProductReview[];
  className?: string;
}

/**
 * Product reviews component.
 *
 * Presentation only: displays reviews with star ratings, reviewer name,
 * date, and comment. No mutations.
 */
export function ProductReviews({ reviews, className }: ProductReviewsProps) {
  if (reviews.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
        No reviews yet.
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <h3 className="text-lg font-semibold">Customer Reviews ({reviews.length})</h3>
      <div className="space-y-4">
        {reviews.map((review, index) => (
          <div
            key={`${review.reviewerName}-${review.date}-${index}`}
            className="rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">{review.reviewerName}</p>
                {review.reviewerEmail && (
                  <p className="text-sm text-muted-foreground">
                    {review.reviewerEmail}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(review.date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={cn(
                      "h-4 w-4",
                      star <= review.rating
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {review.comment}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
