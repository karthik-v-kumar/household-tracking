import { useState } from "react";
import { NewListDialog } from "@/components/new-list-dialog";
import { cn } from "@/lib/utils";

export function ListPicker({
  label,
  lists,
  value,
  onChange,
}: {
  label: string;
  lists: { id: number; name: string }[];
  value: number | "";
  onChange: (value: number | "") => void;
}) {
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "min-h-11 rounded-full border px-3 py-2 text-sm",
            value === ""
              ? "border-fg bg-primary text-primary-fg"
              : "border-border bg-bg-elevated text-fg",
          )}
        >
          Any list
        </button>
        {lists.map((list) => {
          const selected = value === list.id;
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => onChange(list.id)}
              className={cn(
                "min-h-11 rounded-full border px-3 py-2 text-sm",
                selected
                  ? "border-fg bg-primary text-primary-fg"
                  : "border-border bg-bg-elevated text-fg",
              )}
            >
              {list.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="min-h-11 rounded-full border border-dashed border-fg/30 px-3 py-2 text-sm text-muted"
        >
          New list
        </button>
      </div>
      <NewListDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => onChange(id)}
      />
    </div>
  );
}
