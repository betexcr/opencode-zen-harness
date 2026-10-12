import type { CartLine } from "@/lib/domain/cart";
import { estimateOrderTotals } from "@/lib/domain/cart";
import {
  reconcileProductById,
  type CatalogSources,
} from "@/lib/domain/product";
import {
  selectCreatedProductById,
  selectCreatedProductCount,
  selectFeaturedProductIds,
  selectIsHidden,
  selectIsWishlisted,
  selectLocale,
  selectMerchandisingConfig,
  selectOrderByNumber,
  selectOrderCount,
  selectOrdersTotalCents,
  selectOverridePatch,
  selectTombstones,
  selectWishlistCount,
  useCartStore,
  useCreatedProductsStore,
  useMerchandisingStore,
  useOrdersStore,
  useOverridesStore,
  usePreferencesStore,
  useWishlistStore,
  DEFAULT_MERCHANDISING_CONFIG,
  DEFAULT_PREFERENCES,
  STORAGE_KEYS,
  STORAGE_VERSION,
  normalizeSort,
  type NewLocalProduct,
  type SupportedLocale,
} from "@/lib/state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeProduct } from "../api/fixtures";

const lineA: CartLine = {
  productId: 1,
  title: "Essence Mascara Lash Princess",
  thumbnail: "a.webp",
  price: 10,
  discountPercentage: 0,
  quantity: 1,
};

const lineB: CartLine = {
  productId: 2,
  title: "Eyeshadow Palette",
  thumbnail: "b.webp",
  price: 24.5,
  discountPercentage: 10,
  quantity: 1,
};

function resetStores(): void {
  useCartStore.setState({ lines: [] });
  useWishlistStore.setState({ ids: [] });
  useOverridesStore.setState({ overrides: [], tombstones: [] });
  useCreatedProductsStore.setState({ products: [] });
  useMerchandisingStore.setState({
    config: { ...DEFAULT_MERCHANDISING_CONFIG },
  });
  useOrdersStore.setState({ orders: [] });
  usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES } });
  window.localStorage.clear();
}

function readPersistedState<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  return (JSON.parse(raw) as { state: T }).state;
}

function localProductInput(): NewLocalProduct {
  const base = makeProduct();
  return {
    title: "Handmade Candle",
    description: "A small-batch soy wax candle.",
    category: "home",
    price: 18,
    discountPercentage: 0,
    stock: 12,
    tags: ["home", "candle"],
    sku: "LOC-001",
    weight: 1,
    warrantyInformation: "No warranty",
    shippingInformation: "Ships in 2 days",
    availabilityStatus: "In Stock",
    returnPolicy: "30 days return policy",
    minimumOrderQuantity: 1,
    thumbnail: base.thumbnail,
  };
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetStores();
});

describe("cart store actions", () => {
  it("adds, merges and adjusts quantities as pure reducers", () => {
    const { addLine } = useCartStore.getState();
    addLine(lineA, 2);
    addLine(lineA, 1);
    expect(useCartStore.getState().lines).toEqual([{ ...lineA, quantity: 3 }]);

    useCartStore.getState().incrementLine(lineA.productId, 2);
    expect(useCartStore.getState().lines[0].quantity).toBe(5);

    useCartStore.getState().decrementLine(lineA.productId);
    expect(useCartStore.getState().lines[0].quantity).toBe(4);

    useCartStore.getState().setQuantity(lineA.productId, 0);
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("ignores non-positive additions and operations on missing lines", () => {
    useCartStore.getState().addLine(lineA, 0);
    useCartStore.getState().incrementLine(999);
    useCartStore.getState().decrementLine(999);
    useCartStore.getState().removeLine(999);
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("removes and clears lines", () => {
    useCartStore.getState().addLine(lineA);
    useCartStore.getState().addLine(lineB);
    useCartStore.getState().removeLine(lineA.productId);
    expect(useCartStore.getState().lines).toEqual([lineB]);
    useCartStore.getState().clear();
    expect(useCartStore.getState().lines).toEqual([]);
  });
});

describe("wishlist store actions", () => {
  it("toggles, de-duplicates and clears saved ids", () => {
    const store = () => useWishlistStore.getState();
    store().add(5);
    store().add(5);
    expect(store().ids).toEqual([5]);
    expect(selectWishlistCount(store())).toBe(1);
    expect(selectIsWishlisted(5)(store())).toBe(true);

    store().toggle(5);
    expect(store().ids).toEqual([]);
    store().toggle(5);
    store().toggle(9);
    expect(store().ids).toEqual([5, 9]);

    store().remove(5);
    expect(store().ids).toEqual([9]);
    store().clear();
    expect(store().ids).toEqual([]);
  });
});

describe("overrides store actions", () => {
  it("merges patches and manages tombstones", () => {
    const store = () => useOverridesStore.getState();
    store().setOverride(1, { price: 5 });
    store().setOverride(1, { brand: "Meridian", title: "Refined" });
    expect(store().overrides).toEqual([
      { id: 1, patch: { price: 5, brand: "Meridian", title: "Refined" } },
    ]);
    expect(selectOverridePatch(1)(store())).toEqual({
      price: 5,
      brand: "Meridian",
      title: "Refined",
    });

    store().hideProduct(1);
    store().hideProduct(1);
    expect(store().tombstones).toEqual([1]);
    expect(selectIsHidden(1)(store())).toBe(true);
    store().restoreProduct(1);
    expect(store().tombstones).toEqual([]);

    store().removeOverride(1);
    expect(store().overrides).toEqual([]);
    store().clear();
    expect(store().overrides).toEqual([]);
  });

  it("keeps the caller-supplied timestamp and merges it forward", () => {
    const store = () => useOverridesStore.getState();
    store().setOverride(2, { price: 1 }, "2026-01-01T00:00:00.000Z");
    store().setOverride(2, { stock: 4 });
    expect(store().overrides[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("reconciles overrides and tombstones against immutable remote data", () => {
    const remote = makeProduct({ id: 1, price: 9.99, brand: "Essence", sku: "BEA-001" });
    useOverridesStore.getState().setOverride(1, { price: 4.5 });

    const baseSources: CatalogSources = {
      remote: [remote],
      overrides: useOverridesStore.getState().overrides,
      created: [],
      tombstones: useOverridesStore.getState().tombstones,
    };

    const merged = reconcileProductById(1, baseSources);
    expect(merged?.price).toBe(4.5);
    expect(merged?.overridden).toBe(true);
    expect(merged?.origin).toBe("remote");
    expect(remote.price).toBe(9.99);

    useOverridesStore.getState().hideProduct(1);
    const hidden = reconcileProductById(1, {
      remote: [remote],
      overrides: [],
      created: [],
      tombstones: selectTombstones(useOverridesStore.getState()),
    });
    expect(hidden).toBeUndefined();
  });
});

describe("created-products store actions", () => {
  it("allocates negative ids and updates local products", () => {
    const store = () => useCreatedProductsStore.getState();
    const first = store().create(localProductInput());
    const second = store().create(localProductInput());
    expect(first).toBe(-1);
    expect(second).toBe(-2);
    expect(selectCreatedProductCount(store())).toBe(2);

    store().update(first, { price: 21 });
    expect(selectCreatedProductById(first)(store())?.price).toBe(21);
    expect(selectCreatedProductById(first)(store())?.id).toBe(first);

    store().remove(second);
    expect(selectCreatedProductCount(store())).toBe(1);
    store().clear();
    expect(store().products).toEqual([]);
  });
});

describe("merchandising store actions", () => {
  it("curates, reorders and resets merchandising decisions", () => {
    const store = () => useMerchandisingStore.getState();
    store().featureProduct(1);
    store().featureProduct(2);
    store().featureProduct(1);
    expect(selectFeaturedProductIds(store())).toEqual([1, 2]);

    store().reorderFeaturedProduct(1, 1);
    expect(selectFeaturedProductIds(store())).toEqual([2, 1]);

    store().curateProduct(7);
    store().setSort("price-asc");
    store().setFeaturedHeadline("New in");
    const config = selectMerchandisingConfig(store());
    expect(config.curatedProductIds).toEqual([7]);
    expect(config.sort).toBe("price-asc");
    expect(config.featuredHeadline).toBe("New in");

    store().uncurateProduct(7);
    expect(selectMerchandisingConfig(store()).curatedProductIds).toEqual([]);

    store().reset();
    expect(selectMerchandisingConfig(store())).toEqual(DEFAULT_MERCHANDISING_CONFIG);
  });

  it("normalizes an unknown sort mode to `curated`", () => {
    expect(normalizeSort("price-desc")).toBe("price-desc");
    expect(normalizeSort("nonsense")).toBe("curated");
    useMerchandisingStore.getState().setSort(normalizeSort("nonsense"));
    expect(selectMerchandisingConfig(useMerchandisingStore.getState()).sort).toBe(
      "curated",
    );
  });
});

describe("orders store actions", () => {
  it("places immutable demo orders and tracks their status", () => {
    const store = () => useOrdersStore.getState();
    const estimate = estimateOrderTotals([lineA]);
    const mutable: CartLine = { ...lineA, quantity: 1 };

    const first = store().placeOrder([mutable], estimate, "2026-01-01T00:00:00.000Z");
    const second = store().placeOrder([lineA, lineB], estimate, "2026-01-02T00:00:00.000Z");
    expect(first).toBe(1);
    expect(second).toBe(2);

    const order = store().orders[0];
    expect(order.lines[0]).not.toBe(mutable);
    expect(order.estimate).not.toBe(estimate);

    mutable.quantity = 99;
    expect(order.lines[0].quantity).toBe(1);

    store().setStatus(1, "fulfilled");
    expect(selectOrderByNumber(1)(store())?.status).toBe("fulfilled");

    store().remove(1);
    expect(selectOrderCount(store())).toBe(1);
    expect(selectOrdersTotalCents(store())).toBe(estimate.totalCents);

    store().clear();
    expect(selectOrderCount(store())).toBe(0);
  });
});

describe("preferences store actions", () => {
  it("manages presentation preferences and rejects unsupported locales", () => {
    const store = () => usePreferencesStore.getState();
    store().setLocale("fr-FR");
    expect(selectLocale(store())).toBe("fr-FR");

    store().setLocale("xx-YY" as SupportedLocale);
    expect(selectLocale(store())).toBe("fr-FR");

    store().setDensity("compact");
    expect(store().preferences.density).toBe("compact");
    store().setReduceMotion(true);
    expect(store().preferences.reduceMotion).toBe(true);
    store().setShowOutOfStock(false);
    expect(store().preferences.showOutOfStock).toBe(false);

    store().reset();
    expect(store().preferences).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("persistence round-trip across a simulated refresh", () => {
  it("restores the cart from storage", async () => {
    useCartStore.getState().addLine(lineA, 2);
    const snapshot = window.localStorage.getItem(STORAGE_KEYS.cart);
    expect(snapshot).not.toBeNull();

    useCartStore.setState({ lines: [] });
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.cart, snapshot as string);
    expect(useCartStore.getState().lines).toEqual([]);

    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().lines).toEqual([{ ...lineA, quantity: 2 }]);
  });

  it("restores the merchandising config from storage", async () => {
    useMerchandisingStore.getState().featureProduct(7);
    useMerchandisingStore.getState().setSort("rating");
    const snapshot = window.localStorage.getItem(STORAGE_KEYS.merchandising);
    expect(snapshot).not.toBeNull();

    useMerchandisingStore.setState({
      config: { ...DEFAULT_MERCHANDISING_CONFIG },
    });
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.merchandising, snapshot as string);

    await useMerchandisingStore.persist.rehydrate();
    const config = selectMerchandisingConfig(useMerchandisingStore.getState());
    expect(config.featuredProductIds).toEqual([7]);
    expect(config.sort).toBe("rating");
  });

  it("restores demo orders with their line snapshots from storage", async () => {
    const estimate = estimateOrderTotals([lineA]);
    useOrdersStore
      .getState()
      .placeOrder([lineA], estimate, "2026-01-01T00:00:00.000Z");
    const snapshot = window.localStorage.getItem(STORAGE_KEYS.orders);
    expect(snapshot).not.toBeNull();

    useOrdersStore.setState({ orders: [] });
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.orders, snapshot as string);

    await useOrdersStore.persist.rehydrate();
    const orders = useOrdersStore.getState().orders;
    expect(orders).toHaveLength(1);
    expect(orders[0].lines[0].title).toBe(lineA.title);
    expect(orders[0].estimate.totalCents).toBe(estimate.totalCents);
  });

  it("restores merchant-created products in full across a refresh", async () => {
    const id = useCreatedProductsStore.getState().create(localProductInput());
    const snapshot = window.localStorage.getItem(STORAGE_KEYS.createdProducts);
    expect(snapshot).not.toBeNull();

    useCreatedProductsStore.setState({ products: [] });
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.createdProducts, snapshot as string);

    await useCreatedProductsStore.persist.rehydrate();
    expect(
      selectCreatedProductById(id)(useCreatedProductsStore.getState())?.title,
    ).toBe("Handmade Candle");
  });
});

describe("remote sample data isolation", () => {
  it("persists only user-owned slices, never full remote records", () => {
    const remote = makeProduct({ id: 42, sku: "BEA-X-042", title: "Remote Thing" });
    useWishlistStore.getState().add(remote.id);
    useOverridesStore.getState().setOverride(remote.id, { price: 1 });

    const wishlist = readPersistedState<{ ids: number[] }>(STORAGE_KEYS.wishlist);
    expect(wishlist?.ids).toEqual([42]);
    const wishlistRaw = window.localStorage.getItem(STORAGE_KEYS.wishlist) ?? "";
    expect(wishlistRaw).not.toContain("sku");
    expect(wishlistRaw).not.toContain("Remote Thing");

    const overrides = readPersistedState<{
      overrides: { id: number; patch: Record<string, unknown> }[];
      tombstones: number[];
    }>(STORAGE_KEYS.overrides);
    expect(overrides?.overrides).toEqual([{ id: 42, patch: { price: 1 } }]);
    const overridesRaw = window.localStorage.getItem(STORAGE_KEYS.overrides) ?? "";
    expect(overridesRaw).not.toContain("sku");
    expect(overridesRaw).not.toContain("Remote Thing");

    expect(useCreatedProductsStore.getState().products).toEqual([]);
    expect(selectFeaturedProductIds(useMerchandisingStore.getState())).toEqual([]);
  });
});

describe("store storage failure tolerance", () => {
  it("rehydrates without throwing when storage reads fail", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    let error: unknown = null;
    try {
      await useCartStore.persist.rehydrate();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeNull();
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("keeps working in memory when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    useCartStore.getState().addLine(lineA);
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(window.localStorage.getItem(STORAGE_KEYS.cart)).toBeNull();
  });
});

describe("persisted payload shape", () => {
  it("records the shared schema version on every store key", () => {
    useCartStore.getState().addLine(lineA);
    useWishlistStore.getState().add(lineA.productId);
    usePreferencesStore.getState().setDensity("compact");

    for (const key of [
      STORAGE_KEYS.cart,
      STORAGE_KEYS.wishlist,
      STORAGE_KEYS.preferences,
    ]) {
      const raw = window.localStorage.getItem(key);
      expect(raw).not.toBeNull();
      expect((JSON.parse(raw as string) as { version: number }).version).toBe(
        STORAGE_VERSION,
      );
    }
  });
});
