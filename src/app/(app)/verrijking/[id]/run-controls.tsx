"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { togglePause } from "@/features/enrichment/actions";

export function RunControls({ runId, status }: { runId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = status === "wachtrij" || status === "bezig";

  // Zolang de run loopt, elke 15 seconden verversen.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [active, router]);

  if (status === "klaar" || status === "fout") return null;
  return (
    <div className="ml-auto flex gap-2">
      {active ? (
        <Button variant="outline" disabled={pending} onClick={() => start(async () => void (await togglePause(runId, true)))}>
          Pauzeer
        </Button>
      ) : (
        <Button disabled={pending} onClick={() => start(async () => void (await togglePause(runId, false)))}>
          Hervat
        </Button>
      )}
    </div>
  );
}
