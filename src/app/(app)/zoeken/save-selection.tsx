"use client";

import { Save } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSelection, type SimpleResult } from "@/features/organizations/actions";
import type { SearchFilter } from "@/features/organizations/search-shared";

export function SaveSelection({ filter }: { filter: SearchFilter }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(async (prev, fd) => {
    const r = await saveSelection(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Save /> Bewaar selectie
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selectie bewaren</DialogTitle>
          <DialogDescription>De huidige filters blijven staan onder een naam, zodat je ze later in één klik terughaalt.</DialogDescription>
        </DialogHeader>
        <form action={action} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="filter" value={JSON.stringify(filter)} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="sel-name">Naam</Label>
            <Input id="sel-name" name="name" placeholder="Bijvoorbeeld: Kerken Gelderland, scriba" autoFocus />
          </div>
          {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              Bewaar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
