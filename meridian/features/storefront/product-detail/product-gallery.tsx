"use client";

import Image from "next/image";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProductGalleryProps {
  /**
   * Product images from DummyJSON API. Order reflects the API order; the
   * first image is the primary image.
   */
  images: readonly string[];
  /**
   * Thumbnail image from DummyJSON API.
   */
  thumbnail: string;
  /**
   * Product title for accessible alt text.
   */
  title: string;
  className?: string;
}

/**
 * Product image gallery using next/image.
 *
 * Interactive (thumbnail selection), so it is a client component; the product
 * detail route that imports it is an async server component, which is why the
 * `"use client"` directive is required here.
 *
 * Presentation only: receives validated product data and renders images with a
 * primary image display. Clicking a thumbnail updates the primary image state.
 * Empty or whitespace-only sources are ignored; when no usable image remains a
 * neutral placeholder is rendered instead of passing an empty `src` to
 * next/image.
 */
export function ProductGallery({
  images,
  thumbnail,
  title,
  className,
}: ProductGalleryProps) {
  const allImages = React.useMemo(() => {
    const unique = new Set<string>();
    const add = (value: string | undefined) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if (trimmed.length > 0) unique.add(trimmed);
    };
    // Prefer the primary thumbnail first, then the remaining gallery images.
    add(thumbnail);
    images.forEach(add);
    return Array.from(unique);
  }, [images, thumbnail]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const safeIndex =
    allImages.length > 0 ? Math.min(selectedIndex, allImages.length - 1) : 0;
  const selectedImage = allImages[safeIndex];

  if (selectedImage === undefined) {
    return (
      <div
        className={cn(
          "flex aspect-square items-center justify-center rounded-xl border border-border bg-surface-sunken text-sm text-muted-foreground",
          className,
        )}
      >
        No image available
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Primary image */}
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-sunken">
        <Image
          src={selectedImage}
          alt={title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
          className="object-cover transition-opacity duration-200"
        />
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all",
                safeIndex === index
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40",
              )}
              aria-label={`Show image ${index + 1} of ${allImages.length}`}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
