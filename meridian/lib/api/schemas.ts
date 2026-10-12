import { z } from "zod";

/**
 * Zod schemas and inferred types for every DummyJSON resource consumed by
 * Meridian. Schemas are intentionally explicit rather than `.passthrough()` so
 * that malformed or truncated payloads fail validation and surface as a typed
 * `ApiError` instead of poisoning downstream state.
 */

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

export const productDimensionsSchema = z.object({
  width: z.number(),
  height: z.number(),
  depth: z.number(),
});
export type ProductDimensions = z.infer<typeof productDimensionsSchema>;

export const productReviewSchema = z.object({
  rating: z.number(),
  comment: z.string(),
  date: z.string(),
  reviewerName: z.string(),
  reviewerEmail: z.string(),
});
export type ProductReview = z.infer<typeof productReviewSchema>;

export const productSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number(),
  discountPercentage: z.number(),
  rating: z.number(),
  stock: z.number(),
  tags: z.array(z.string()),
  brand: z.string().optional(),
  sku: z.string(),
  weight: z.number(),
  dimensions: productDimensionsSchema,
  warrantyInformation: z.string(),
  shippingInformation: z.string(),
  availabilityStatus: z.string(),
  reviews: z.array(productReviewSchema),
  returnPolicy: z.string(),
  minimumOrderQuantity: z.number(),
  images: z.array(z.string()),
  thumbnail: z.string(),
});
export type Product = z.infer<typeof productSchema>;

export const productListResponseSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

export const productCategorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
});
export type ProductCategory = z.infer<typeof productCategorySchema>;

/** `GET /products/categories` returns a top-level array, not a wrapped object. */
export const productCategoriesSchema = z.array(productCategorySchema);
export type ProductCategoryList = z.infer<typeof productCategoriesSchema>;

/** `GET /products/category-list` returns a top-level array of slugs. */
export const categoryListSchema = z.array(z.string());
export type CategoryList = z.infer<typeof categoryListSchema>;

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * DummyJSON users carry deliberately sensitive demo fields (`password`, `ssn`,
 * `bank`, `ein`, `userAgent`, `crypto`). They are parsed so the contract stays
 * faithful, but they are optional (never required for rendering) and MUST NOT
 * be surfaced in the UI — see `publicUserSchema` / `toPublicUser` for the safe
 * projection used by presentation code.
 */

export const userHairSchema = z.object({
  color: z.string(),
  type: z.string(),
});
export type UserHair = z.infer<typeof userHairSchema>;

export const userCoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type UserCoordinates = z.infer<typeof userCoordinatesSchema>;

export const userAddressSchema = z.object({
  address: z.string(),
  city: z.string(),
  state: z.string(),
  stateCode: z.string(),
  postalCode: z.string(),
  coordinates: userCoordinatesSchema,
  country: z.string(),
});
export type UserAddress = z.infer<typeof userAddressSchema>;

export const userBankSchema = z.object({
  cardExpire: z.string(),
  cardNumber: z.string(),
  cardType: z.string(),
  currency: z.string(),
  iban: z.string(),
});
export type UserBank = z.infer<typeof userBankSchema>;

export const userCompanySchema = z.object({
  department: z.string(),
  name: z.string(),
  title: z.string(),
  address: userAddressSchema,
});
export type UserCompany = z.infer<typeof userCompanySchema>;

export const userCryptoSchema = z.object({
  coin: z.string(),
  wallet: z.string(),
  network: z.string(),
});
export type UserCrypto = z.infer<typeof userCryptoSchema>;

export const userSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  maidenName: z.string(),
  age: z.number(),
  gender: z.string(),
  email: z.string(),
  phone: z.string(),
  username: z.string(),
  password: z.string().optional(),
  birthDate: z.string(),
  image: z.string(),
  bloodGroup: z.string(),
  height: z.number(),
  weight: z.number(),
  eyeColor: z.string(),
  hair: userHairSchema,
  ip: z.string().optional(),
  address: userAddressSchema,
  macAddress: z.string().optional(),
  university: z.string(),
  bank: userBankSchema.optional(),
  company: userCompanySchema,
  ein: z.string().optional(),
  ssn: z.string().optional(),
  userAgent: z.string().optional(),
  crypto: userCryptoSchema.optional(),
  role: z.string(),
});
export type User = z.infer<typeof userSchema>;

/**
 * Presentation-safe projection of a user. Strips every sensitive demo field
 * before the value is allowed into the UI layer.
 */
export const publicUserSchema = userSchema.omit({
  password: true,
  ssn: true,
  bank: true,
  ein: true,
  userAgent: true,
  crypto: true,
  ip: true,
  macAddress: true,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export function toPublicUser(user: User): PublicUser {
  return publicUserSchema.parse(user);
}

export const userListResponseSchema = z.object({
  users: z.array(userSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});
export type UserListResponse = z.infer<typeof userListResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Carts                                                                       */
/* -------------------------------------------------------------------------- */

export const cartItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.number(),
  quantity: z.number(),
  total: z.number(),
  discountPercentage: z.number(),
  discountedTotal: z.number(),
  thumbnail: z.string(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.number(),
  products: z.array(cartItemSchema),
  total: z.number(),
  discountedTotal: z.number(),
  userId: z.number(),
  totalProducts: z.number(),
  totalQuantity: z.number(),
});
export type Cart = z.infer<typeof cartSchema>;

export const cartListResponseSchema = z.object({
  carts: z.array(cartSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});
export type CartListResponse = z.infer<typeof cartListResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Auth (demo only)                                                            */
/* -------------------------------------------------------------------------- */

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  expiresInMins: z.number().int().positive().optional(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * Response of `POST /auth/login`. This is a mock service: the token grants no
 * real authority and must never be treated as durable server-side auth.
 */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  id: z.number(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string(),
  image: z.string(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;
