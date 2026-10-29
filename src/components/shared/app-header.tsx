"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/zoeken", label: "Zoeken" },
  { href: "/verrijking", label: "Verrijking" },
  { href: "/exports", label: "Exports" },
  { href: "/bronnen", label: "Bronnen" },
];

export function AppHeader({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-paper/90 backdrop-blur-[10px]">
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-8 px-6">
        <Link href="/zoeken" className="flex items-center gap-3" aria-label="Organisatiezoeker">
          <Logo variant="mark" className="h-8" />
          <span className="font-serif text-lg font-medium tracking-tight">Organisatiezoeker</span>
        </Link>
        <nav className="flex gap-6 text-sm" aria-label="Hoofdnavigatie">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b-2 py-5 transition-colors hover:text-brand-strong",
                  active ? "border-brand font-medium text-foreground" : "border-transparent text-navy-700",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
          <Button asChild variant="ghost" size="icon" aria-label="Instellingen">
            <Link href="/instellingen">
              <Settings />
            </Link>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Uitloggen">
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
