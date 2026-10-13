"use client";

import { useState, type FormEvent } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOG_SORT_OPTIONS,
  type CatalogSortField,
} from "@/features/storefront/queries/catalog-params";
import type { SortOrder } from "@/lib/api/products";

/**
 * Storefront catalogue toolbar: text search and sort.
 *
 * Every control writes to the URL search params only, so the server-driven list
 * stays the source of truth. The sortBy/order pair follows the DummyJSON list
 * contract (sortBy=price&order=asc); the default option removes both keys.
 * Changing the sort or submitting a search resets page to the first page.
 */

function findSortValue(sortBy?: CatalogSortField, order?: SortOrder): string {
  if (!sortBy) return "default";
  const option = CATALOG_SORT_OPTIONS.find(
    (candidate) => candidate.sortBy === sortBy && candidate.order === order,
  );
  return option?.value ?? "default";
}

export interface CatalogToolbarProps {
  sortBy?: CatalogSortField;
  order?: SortOrder;
  q?: string;
  isFetching?: boolean;
}

export function CatalogToolbar({
  sortBy,
  order,
  q = "",
  isFetching = false,
}: CatalogToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    router.push("?" + params.toString());
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ q: search.trim() });
  }

  function handleSortChange(value: string | null) {
    if (!value || value === "default") {
      updateParams({ sortBy: null, order: null });
      return;
    }
    const option = CATALOG_SORT_OPTIONS.find(
      (candidate) => candidate.value === value,
    );
    if (!option) return;
    updateParams({ sortBy: option.sortBy, order: option.order });
  }

  const sortValue = findSortValue(sortBy, order);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        onSubmit={handleSearchSubmit}
        className="flex w-full gap-2 sm:max-w-sm"
        role="search"
      >
        <Input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search products"
          disabled={isFetching}
        />
        <Button type="submit" variant="outline" disabled={isFetching}>
          Search
        </Button>
      </form>
      <Select
        value={sortValue}
        onValueChange={handleSortChange}
        disabled={isFetching}
      >
        <SelectTrigger className="w-full sm:w-[220px]" aria-label="Sort products">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          {CATALOG_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}