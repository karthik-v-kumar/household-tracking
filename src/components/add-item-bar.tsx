import { useEffect, useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchCatalog } from "@/lib/server/lists";
import type { CatalogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AddItemBar({
  listId,
  onAdd,
  busy,
}: {
  listId: number;
  onAdd: (input: { name: string; quantity?: string; isStaple: boolean }) => void;
  busy?: boolean;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [staple, setStaple] = useState(false);
  const [open, setOpen] = useState(false);
  const trimmed = name.trim();

  const suggestions = useQuery({
    queryKey: ["catalog", listId, trimmed],
    queryFn: () => searchCatalog({ data: { q: trimmed, listId } }),
    enabled: trimmed.length > 0,
  });

  const matches = useMemo(
    () =>
      (suggestions.data ?? []).filter(
        (item) => item.name.toLowerCase() !== trimmed.toLowerCase(),
      ),
    [suggestions.data, trimmed],
  );

  useEffect(() => {
    setOpen(trimmed.length > 0 && matches.length > 0);
  }, [trimmed, matches.length]);

  function submit(item?: CatalogItem) {
    const value = (item?.name ?? trimmed).trim();
    if (!value) return;
    onAdd({
      name: value,
      quantity: quantity.trim() || undefined,
      isStaple: item?.isStaple || staple,
    });
    setName("");
    setQuantity("");
    setStaple(false);
    setOpen(false);
  }

  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-card)]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add milk, limes…"
          className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
          autoComplete="off"
          enterKeyHint="done"
        />
        <Input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          className="h-11 w-16 shrink-0 border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0"
          autoComplete="off"
        />
        <button
          type="button"
          aria-pressed={staple}
          aria-label="Remember as usual"
          onClick={() => setStaple((v) => !v)}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-sm",
            staple ? "text-primary" : "text-subtle hover:text-fg",
          )}
        >
          <Star className={cn("size-4", staple && "fill-primary")} />
        </button>
        <Button
          type="submit"
          size="icon"
          disabled={busy || !trimmed}
          aria-label="Add item"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {open ? (
        <ul className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-lg bg-surface py-1 shadow-[var(--shadow-card)]">
          {matches.slice(0, 6).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-fg/5"
                onClick={() => submit(item)}
              >
                <span>{item.name}</span>
                {item.isStaple ? <span className="text-xs text-muted">Usual</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
