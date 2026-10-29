"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addContact, forgetOrganization, refetchOrganization, unblockOrganization, updateOrganization, type SimpleResult } from "@/features/organizations/actions";

export function OrgActions({
  org,
  roles,
}: {
  org: { id: string; blocked: boolean; busy: boolean; general_email: string | null; website: string | null };
  roles: { key: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addState, addAction, addPending] = useActionState<SimpleResult | null, FormData>(async (p, fd) => {
    const r = await addContact(p, fd);
    if (r.ok) setAddOpen(false);
    return r;
  }, null);
  const [editState, editAction, editPending] = useActionState<SimpleResult | null, FormData>(async (p, fd) => {
    const r = await updateOrganization(p, fd);
    if (r.ok) setEditOpen(false);
    return r;
  }, null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending || org.busy || org.blocked} onClick={() => start(async () => void (await refetchOrganization(org.id)))}>
        <RefreshCw /> {org.busy ? "Bezig met ophalen" : "Haal opnieuw op"}
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Bewerk gegevens</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gegevens bewerken</DialogTitle>
            <DialogDescription>Website en algemeen adres; de rest komt van de bronnen.</DialogDescription>
          </DialogHeader>
          <form action={editAction} noValidate className="flex flex-col gap-4">
            <input type="hidden" name="organizationId" value={org.id} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" defaultValue={org.website ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="general_email">Algemeen e-mailadres</Label>
              <Input id="general_email" name="general_email" type="email" defaultValue={org.general_email ?? ""} />
            </div>
            {editState && !editState.ok ? <p className="text-sm text-destructive">{editState.error}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={editPending}>
                Bewaar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button variant="accent" disabled={org.blocked}>
            <Plus /> Voeg contactpersoon toe
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contactpersoon toevoegen</DialogTitle>
            <DialogDescription>Alleen wat de organisatie zelf openbaar heeft gemaakt; noteer waar je het vond.</DialogDescription>
          </DialogHeader>
          <form action={addAction} noValidate className="flex flex-col gap-4">
            <input type="hidden" name="organizationId" value={org.id} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-role">Rol</Label>
              <Select name="role" defaultValue={roles[0]?.key}>
                <SelectTrigger id="c-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-name">Naam</Label>
              <Input id="c-name" name="display_name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-email">E-mailadres</Label>
              <Input id="c-email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-phone">Telefoon</Label>
              <Input id="c-phone" name="phone" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-src">Bron (URL)</Label>
              <Input id="c-src" name="source_url" placeholder="https://" />
            </div>
            {addState && !addState.ok ? <p className="text-sm text-destructive">{addState.error}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={addPending}>
                Voeg toe
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {org.blocked ? (
        <Button variant="ghost" disabled={pending} onClick={() => start(async () => void (await unblockOrganization(org.id)))}>
          Hef blokkade op
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (confirm("Alle contactpersonen en opgehaalde pagina's van deze organisatie worden verwijderd en de organisatie wordt niet meer verrijkt. Doorgaan?")) {
              start(async () => void (await forgetOrganization(org.id)));
            }
          }}
        >
          <Trash2 /> Vergeet deze organisatie
        </Button>
      )}
    </div>
  );
}
