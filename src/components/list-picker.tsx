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
            "h-9 rounded-full border px-3 text-sm",
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
                "h-9 rounded-full border px-3 text-sm",
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
          className="h-9 rounded-full border border-dashed border-border px-3 text-sm text-muted"
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

export function ListMultiPicker({
  label,
  hint,
  lists,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  lists: { id: number; name: string }[];
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const any = value.length === 0;

  function toggle(id: number) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id));
    else onChange([...value, id]);
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            "h-9 rounded-full border px-3 text-sm",
            any ? "border-fg bg-primary text-primary-fg" : "border-border bg-bg-elevated text-fg",
          )}
        >
          Any list
        </button>
        {lists.map((list) => {
          const selected = value.includes(list.id);
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => toggle(list.id)}
              className={cn(
                "h-9 rounded-full border px-3 text-sm",
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
          className="h-9 rounded-full border border-dashed border-border px-3 text-sm text-muted"
        >
          New list
        </button>
      </div>
      <NewListDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => onChange(any ? [id] : [...value, id])}
      />
    </div>
  );
}
