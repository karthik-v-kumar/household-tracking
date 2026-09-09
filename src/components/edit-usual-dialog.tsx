import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { ListMultiPicker } from "@/components/list-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeUsual, updateUsual } from "@/lib/server/lists";
import type { ShoppingList, Usual } from "@/lib/types";

export function EditUsualDialog({
  open,
  onOpenChange,
  usual,
  lists,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usual: Usual | null;
  lists: Pick<ShoppingList, "id" | "name">[];
  onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [listIds, setListIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open || !usual) return;
    setName(usual.name);
    setListIds(usual.listIds);
  }, [open, usual]);

  const save = useMutation({
    mutationFn: () =>
      updateUsual({
        data: {
          id: usual!.id,
          name: name.trim(),
          listIds,
        },
      }),
    onSuccess: async () => {
      toast.success("Usual updated");
      await onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => removeUsual({ data: { id: usual!.id } }),
    onSuccess: async () => {
      toast.success("Removed from usuals");
      await onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit usual</DialogTitle>
          <DialogDescription>
            Pick the stores this belongs on. Yogurt can live on Whole Foods and Trader Joe’s
            without showing up at Costco.
          </DialogDescription>
        </DialogHeader>
        {usual ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              save.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="usual-name">Name</Label>
              <Input
                id="usual-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </div>
            <ListMultiPicker
              label="Show on"
              hint="Any list keeps it in every tray. Pick stores to pin it."
              lists={lists}
              value={listIds}
              onChange={setListIds}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                disabled={save.isPending || remove.isPending}
                onClick={() => remove.mutate()}
              >
                Remove from usuals
              </Button>
              <Button type="submit" disabled={!name.trim() || save.isPending || remove.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ManageUsualsDialog({
  open,
  onOpenChange,
  usuals,
  lists,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuals: Usual[];
  lists: Pick<ShoppingList, "id" | "name">[];
  onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<Usual | null>(null);

  return (
    <>
      <Dialog
        open={open && !editing}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuals</DialogTitle>
            <DialogDescription>
              Tap one to rename it or pin it to specific lists.
            </DialogDescription>
          </DialogHeader>
          {usuals.length === 0 ? (
            <p className="text-sm text-muted">Star an item while you shop to remember it here.</p>
          ) : (
            <div className="grid">
              {usuals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex items-center gap-3 border-b border-hairline py-3 text-left last:border-0"
                  onClick={() => setEditing(item)}
                >
                  <Star className="size-3.5 shrink-0 fill-fg text-fg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {item.listNames.length ? item.listNames.join(" · ") : "Any list"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <EditUsualDialog
        open={Boolean(editing)}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        usual={editing}
        lists={lists}
        onSaved={onSaved}
      />
    </>
  );
}
