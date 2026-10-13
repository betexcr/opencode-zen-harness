"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCategoryList } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

/**
 * Category filter.
 *
 * Reflects the active category from the URL and, on change, rewrites only the
 * URL search params so the server-driven list re-renders from one source of
 * truth. The DummyJSON category contract is an array of { slug, name, url };
 * slug is the stable value written to the URL and name is the human label.
 *
 * Navigation is a query-only push, which preserves the current pathname.
 */
export interface CategoryFilterProps {
  categories?: ProductCategoryList;
  currentCategory?: string | null;
  isLoading?: boolean;
  className?: string;
}

export function CategoryFilter({
  categories = [],
  currentCategory,
  isLoading = false,
  className,
}: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushWithCategory(nextCategory: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextCategory === null) {
      params.delete("category");
    } else {
      params.set("category", nextCategory);
    }
    params.delete("page");
    router.push("?" + params.toString());
  }

  function handleCategoryChange(value: string | null) {
    pushWithCategory(value === null || value === "all" ? null : value);
  }

  function clearCategory() {
    pushWithCategory(null);
  }

  const value = currentCategory ?? "all";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Category</h3>
        {currentCategory ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearCategory}
            disabled={isLoading}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <Select
        value={value}
        onValueChange={handleCategoryChange}
        disabled={isLoading}
      >
        <SelectTrigger aria-label="Filter by category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.slug} value={category.slug}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}