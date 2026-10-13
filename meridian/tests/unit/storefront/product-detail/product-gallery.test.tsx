import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductGallery } from "@/features/storefront/product-detail/product-gallery";

/**
 * `next/image` is replaced with a deterministic passthrough so the gallery's
 * `sizes`, `alt`, and `src` props can be asserted without depending on the
 * framework runtime loader, which rewrites `src` to `/_next/image?...`. The mock
 * is still the component the gallery renders through, so it proves next/image is
 * used while keeping assertions stable.
 */
vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: function MockImage(props: {
      src: string;
      alt: string;
      sizes?: string;
      className?: string;
    }) {
      return React.createElement("img", {
        src: props.src,
        alt: props.alt,
        sizes: props.sizes,
        className: props.className,
      });
    },
  };
});

const PRIMARY = "https://cdn.dummyjson.com/product-images/1/1.webp";
const SECOND = "https://cdn.dummyjson.com/product-images/1/2.webp";
const THUMBNAIL = "https://cdn.dummyjson.com/product-images/1/thumbnail.webp";
const TITLE = "Aurora Lamp";
const PRIMARY_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw";

describe("ProductGallery", () => {
  it("renders the primary image with the product title as alt and responsive sizes", () => {
    render(
      <ProductGallery
        images={[THUMBNAIL]}
        thumbnail={THUMBNAIL}
        title={TITLE}
      />,
    );

    const primary = screen.getByAltText(TITLE);
    expect(primary).toHaveAttribute("src", THUMBNAIL);
    expect(primary).toHaveAttribute("sizes", PRIMARY_SIZES);
    expect(primary).toHaveClass("object-cover");
  });

  it("prefers the thumbnail as the initial primary image and lists every unique image", () => {
    render(
      <ProductGallery images={[SECOND]} thumbnail={THUMBNAIL} title={TITLE} />,
    );

    expect(screen.getByAltText(TITLE)).toHaveAttribute("src", THUMBNAIL);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-label", "Show image 1 of 2");
    expect(buttons[1]).toHaveAttribute("aria-label", "Show image 2 of 2");
  });

  it("switches the primary image when a thumbnail is selected", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery images={[SECOND]} thumbnail={THUMBNAIL} title={TITLE} />,
    );

    expect(screen.getByAltText(TITLE)).toHaveAttribute("src", THUMBNAIL);

    await user.click(screen.getByLabelText("Show image 2 of 2"));

    expect(screen.getByAltText(TITLE)).toHaveAttribute("src", SECOND);
  });

  it("renders each thumbnail as a 64px next/image with empty alt text", () => {
    render(
      <ProductGallery images={[SECOND]} thumbnail={THUMBNAIL} title={TITLE} />,
    );

    const thumbnails = screen.getAllByRole("button");
    expect(thumbnails).toHaveLength(2);

    for (const button of thumbnails) {
      const image = button.querySelector("img");
      expect(image).not.toBeNull();
      expect(image).toHaveAttribute("sizes", "64px");
      expect(image).toHaveAttribute("alt", "");
    }
  });

  it("deduplicates the thumbnail when it also appears in images", () => {
    render(
      <ProductGallery
        images={[THUMBNAIL, SECOND]}
        thumbnail={THUMBNAIL}
        title={TITLE}
      />,
    );

    // Thumbnail plus one distinct image => two selectable images, no duplicate.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("does not render thumbnail controls for a single image", () => {
    render(
      <ProductGallery
        images={[THUMBNAIL]}
        thumbnail={THUMBNAIL}
        title={TITLE}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ignores blank and whitespace-only sources", () => {
    render(
      <ProductGallery
        images={["", "   ", SECOND]}
        thumbnail="  "
        title={TITLE}
      />,
    );

    // Only SECOND survives; a lone usable image renders no thumbnail controls.
    expect(screen.getByAltText(TITLE)).toHaveAttribute("src", SECOND);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a neutral placeholder when no usable image remains", () => {
    render(
      <ProductGallery images={["", "   "]} thumbnail="" title={TITLE} />,
    );

    expect(screen.getByText("No image available")).toBeInTheDocument();
    expect(screen.queryByAltText(TITLE)).not.toBeInTheDocument();
  });

  it("applies a custom className to the gallery root", () => {
    const { container } = render(
      <ProductGallery
        images={[THUMBNAIL]}
        thumbnail={THUMBNAIL}
        title={TITLE}
        className="mt-8"
      />,
    );

    expect(container.querySelector(".mt-8")).toBeInTheDocument();
  });
});
