import { z } from "zod";

export const PRODUCT_IMAGE_LIMIT = 8;
export const PRODUCT_TAG_LIMIT = 12;
export const PRODUCT_PRICE_MAX = 1_000_000;
export const PRODUCT_STOCK_MAX = 1_000_000;
export const PRODUCT_QUANTITY_MAX = 10_000;

export const productTitleSchema = z
  .string({
    required_error: "Add a product title.",
    invalid_type_error: "Title must be text.",
  })
  .trim()
  .min(3, { message: "Title must be at least 3 characters." })
  .max(120, { message: "Title must be 120 characters or fewer." });

export const productDescriptionSchema = z
  .string({
    required_error: "Add a product description.",
    invalid_type_error: "Description must be text.",
  })
  .trim()
  .min(10, { message: "Description must be at least 10 characters." })
  .max(2000, { message: "Description must be 2000 characters or fewer." });

export const productCategorySchema = z
  .string({
    required_error: "Choose a category.",
    invalid_type_error: "Category must be text.",
  })
  .trim()
  .min(1, { message: "Choose a category." })
  .max(64, { message: "Category slug is too long." });

export const productBrandSchema = z
  .string({ invalid_type_error: "Brand must be text." })
  .trim()
  .max(80, { message: "Brand must be 80 characters or fewer." })
  .optional();

export const productPriceSchema = z.coerce
  .number({
    required_error: "Add a price.",
    invalid_type_error: "Price must be a number.",
  })
  .min(0.01, { message: "Price must be at least 0.01." })
  .max(PRODUCT_PRICE_MAX, {
    message: `Price must be ${PRODUCT_PRICE_MAX} or less.`,
  })
  .multipleOf(0.01, { message: "Price supports at most two decimal places." });

export const productDiscountPercentageSchema = z.coerce
  .number({
    required_error: "Add a discount percentage.",
    invalid_type_error: "Discount must be a number.",
  })
  .min(0, { message: "Discount cannot be negative." })
  .max(100, { message: "Discount cannot exceed 100%." })
  .multipleOf(0.01, {
    message: "Discount supports at most two decimal places.",
  });

export const productStockSchema = z.coerce
  .number({
    required_error: "Add available stock.",
    invalid_type_error: "Stock must be a number.",
  })
  .int({ message: "Stock must be a whole number." })
  .min(0, { message: "Stock cannot be negative." })
  .max(PRODUCT_STOCK_MAX, {
    message: `Stock must be ${PRODUCT_STOCK_MAX} or less.`,
  });

export const productMinimumOrderQuantitySchema = z.coerce
  .number({
    required_error: "Add a minimum order quantity.",
    invalid_type_error: "Minimum order quantity must be a number.",
  })
  .int({ message: "Minimum order quantity must be a whole number." })
  .min(1, { message: "Minimum order quantity must be at least 1." })
  .max(PRODUCT_QUANTITY_MAX, {
    message: `Minimum order quantity must be ${PRODUCT_QUANTITY_MAX} or less.`,
  });

export const productImageUrlSchema = z
  .string({
    required_error: "Add an image URL.",
    invalid_type_error: "Image URL must be text.",
  })
  .trim()
  .min(1, { message: "Add an image URL." })
  .max(2048, { message: "Image URL is too long." })
  .url({ message: "Enter a valid image URL." });

export const productImagesSchema = z
  .array(productImageUrlSchema, {
    invalid_type_error: "Images must be a list of URLs.",
  })
  .min(1, { message: "Add at least one product image." })
  .max(PRODUCT_IMAGE_LIMIT, {
    message: `Add no more than ${PRODUCT_IMAGE_LIMIT} images.`,
  });

export const productTagSchema = z
  .string({ invalid_type_error: "Each tag must be text." })
  .trim()
  .min(1, { message: "Tags cannot be empty." })
  .max(40, { message: "Each tag must be 40 characters or fewer." });

export const productTagsSchema = z
  .array(productTagSchema, {
    invalid_type_error: "Tags must be a list of text values.",
  })
  .max(PRODUCT_TAG_LIMIT, {
    message: `Add no more than ${PRODUCT_TAG_LIMIT} tags.`,
  });

export const productEditorSchema = z.object({
  title: productTitleSchema,
  description: productDescriptionSchema,
  category: productCategorySchema,
  brand: productBrandSchema,
  price: productPriceSchema,
  discountPercentage: productDiscountPercentageSchema,
  stock: productStockSchema,
  minimumOrderQuantity: productMinimumOrderQuantitySchema,
  images: productImagesSchema,
  tags: productTagsSchema,
});

export type ProductEditorValues = z.infer<typeof productEditorSchema>;
export type ProductEditorInput = z.input<typeof productEditorSchema>;

export const productEditorDefaults: ProductEditorInput = {
  title: "",
  description: "",
  category: "",
  brand: "",
  price: 0,
  discountPercentage: 0,
  stock: 0,
  minimumOrderQuantity: 1,
  images: [],
  tags: [],
};

export function parseTagList(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function parseImageList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}
