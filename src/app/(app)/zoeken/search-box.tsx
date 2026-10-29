"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { filterToQuery, type SearchFilter } from "@/features/organizations/search-shared";

export function SearchBox({ filter }: { filter: SearchFilter }) {
  const router = useRouter();
  const [value, setValue] = useState(filter.q ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (value !== (filter.q ?? "")) router.push(`/zoeken${filterToQuery({ ...filter, q: value })}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Zoeken"
        placeholder="Zoek op naam, plaats, classis of website"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 pl-10"
      />
    </div>
  );
}
