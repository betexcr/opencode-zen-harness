import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * User preference state for Meridian Commerce OS.
 *
 * Small, LOCAL presentation choices owned by the shopper. They are reference
 * data for the UI only and are never derived from remote sample data. Every
 * action is a pure reducer of state; persistence is hydration-safe
 * (`skipHydration`) and failure-tolerant.
 */

export type DensityPreference = "comfortable" | "compact";

/** Preferred locale tags used for money/number formatting. */
export const SUPPORTED_LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface Preferences {
  /** Preferred display locale for formatting. */
  locale: SupportedLocale;
  /** Layout density for product grids. */
  density: DensityPreference;
  /** Honor the OS reduced-motion setting; when true, animations are disabled. */
  reduceMotion: boolean;
  /** Include out-of-stock products in storefront listings. */
  showOutOfStock: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en-US",
  density: "comfortable",
  reduceMotion: false,
  showOutOfStock: true,
};

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

function normalizeDensity(value: unknown): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

export interface PreferencesState {
  /** Current user preferences. */
  preferences: Preferences;
  /** Set the display locale (invalid values are ignored). */
  setLocale: (locale: SupportedLocale) => void;
  /** Set the grid density. */
  setDensity: (density: DensityPreference) => void;
  /** Toggle the reduced-motion preference. */
  setReduceMotion: (reduceMotion: boolean) => void;
  /** Toggle whether out-of-stock products are listed. */
  setShowOutOfStock: (showOutOfStock: boolean) => void;
  /** Reset every preference to defaults. */
  reset: () => void;
}

type PreferencesPersistedState = Pick<PreferencesState, "preferences">;

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: { ...DEFAULT_PREFERENCES },
      setLocale: (locale) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            locale: isSupportedLocale(locale)
              ? locale
              : state.preferences.locale,
          },
        })),
      setDensity: (density) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            density: normalizeDensity(density),
          },
        })),
      setReduceMotion: (reduceMotion) =>
        set((state) => ({
          preferences: { ...state.preferences, reduceMotion },
        })),
      setShowOutOfStock: (showOutOfStock) =>
        set((state) => ({
          preferences: { ...state.preferences, showOutOfStock },
        })),
      reset: () => set({ preferences: { ...DEFAULT_PREFERENCES } }),
    }),
    {
      name: STORAGE_KEYS.preferences,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<PreferencesPersistedState>(),
      partialize: (state) => ({ preferences: state.preferences }),
      merge: (persisted, current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          ...(persisted as Partial<PreferencesPersistedState>).preferences,
        },
      }),
      skipHydration: true,
    },
  ),
);

/* ------------------------------- selectors -------------------------------- */

export const selectPreferences = (state: PreferencesState): Preferences =>
  state.preferences;

export const selectLocale = (state: PreferencesState): SupportedLocale =>
  state.preferences.locale;

export const selectDensity = (state: PreferencesState): DensityPreference =>
  state.preferences.density;

export const selectReduceMotion = (state: PreferencesState): boolean =>
  state.preferences.reduceMotion;

export const selectShowOutOfStock = (state: PreferencesState): boolean =>
  state.preferences.showOutOfStock;
