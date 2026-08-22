import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LIST_COLORS, LIST_ICONS, type ListColorId, type ListIconId } from "@/lib/constants";
import { LIST_COLOR_CLASS, LIST_ICON_MAP } from "@/lib/icons";
import { createList, updateList } from "@/lib/server/lists";
import type { ShoppingList } from "@/lib/types";
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
import { cn } from "@/lib/utils";

export function NewListDialog({
  open,
  onOpenChange,
  list,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: ShoppingList | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(list?.name ?? "");
  const [icon, setIcon] = useState<ListIconId>(list?.icon ?? "shopping-cart");
  const [color, setColor] = useState<ListColorId>(list?.color ?? "sage");

  const save = useMutation({
    mutationFn: async () => {
      if (list) {
        return updateList({ data: { listId: list.id, name: name.trim(), icon, color } });
      }
      return createList({ data: { name: name.trim(), icon, color } });
    },
    onSuccess: async () => {
      toast.success(list ? "List updated" : "List created");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      onOpenChange(false);
      setName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next && list) {
          setName(list.name);
          setIcon(list.icon);
          setColor(list.color);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{list ? "Edit list" : "New list"}</DialogTitle>
          <DialogDescription>
            One list per store keeps the weekend run from turning into a jumble.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            save.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="list-name">Name</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Costco, Trader Joe's…"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-5 gap-2">
              {LIST_ICONS.map((item) => {
                const Icon = LIST_ICON_MAP[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    className={cn(
                      "grid size-11 place-items-center rounded-md border-2",
                      icon === item.id
                        ? "border-fg bg-primary text-primary-fg"
                        : "border-border bg-bg-elevated text-fg",
                    )}
                    aria-label={item.label}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {LIST_COLORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  onClick={() => setColor(item.id)}
                  className={cn(
                    "size-9 rounded-full border border-border",
                    LIST_COLOR_CLASS[item.id],
                    color === item.id && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
                  )}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : list ? "Save" : "Create list"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
