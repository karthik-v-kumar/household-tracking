import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Star } from "lucide-react";
import type { Usual } from "@/lib/types";
import { cn } from "@/lib/utils";

type DragState = {
  id: number;
  name: string;
  x: number;
  y: number;
  over: boolean;
};

function isOverDrop(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  return Boolean(el?.closest("[data-usuals-drop]"));
}

function setDropActive(active: boolean) {
  document.querySelectorAll("[data-usuals-drop]").forEach((node) => {
    if (active) node.setAttribute("data-drop-active", "");
    else node.removeAttribute("data-drop-active");
  });
}

export function UsualsTray({
  usuals,
  onAdd,
  onAddRemaining,
  remainingCount,
  onEdit,
  onManage,
  onDraggingChange,
  busy,
  compact,
  hint,
}: {
  usuals: Usual[];
  onAdd: (usual: Usual) => void;
  onAddRemaining?: () => void;
  remainingCount?: number;
  onEdit?: (usual: Usual) => void;
  onManage?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  busy?: boolean;
  compact?: boolean;
  hint?: string;
}) {
  const missing = usuals.filter((item) => !item.alreadyOnList);
  const addCount = remainingCount ?? missing.length;
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    onDraggingChange?.(Boolean(drag));
    setDropActive(Boolean(drag?.over));
    return () => setDropActive(false);
  }, [drag, onDraggingChange]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="kicker">Usuals</p>
        <div className="flex items-center gap-3">
          {onManage ? (
            <button
              type="button"
              className="civic-link shrink-0 text-xs text-muted hover:text-fg"
              onClick={onManage}
            >
              Edit
            </button>
          ) : null}
          {addCount > 0 && onAddRemaining ? (
            <button
              type="button"
              className="civic-link shrink-0 text-xs text-muted hover:text-fg disabled:opacity-50"
              disabled={busy}
              onClick={onAddRemaining}
            >
              {addCount === 1 ? "Add to list" : `Add ${addCount} to list`}
            </button>
          ) : null}
        </div>
      </div>
      {missing.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {hint ?? "Star an item while you shop. It stays here so you can drop it on a list any week."}
        </p>
      ) : (
        <>
          {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
          <div
            className={cn("chip-tray mt-2", compact && "max-h-[6.25rem]")}
            aria-label="Usuals tray"
          >
            {missing.map((item) => (
              <UsualChipButton
                key={item.id}
                item={item}
                busy={busy}
                dragging={drag?.id === item.id}
                onAdd={() => onAdd(item)}
                onEdit={onEdit ? () => onEdit(item) : undefined}
                onDragChange={setDrag}
              />
            ))}
          </div>
        </>
      )}
      {drag
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-full border border-fg bg-surface px-3.5 py-2 text-sm shadow-card"
              style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -120%)" }}
            >
              <Star className="size-3 fill-fg" />
              {drag.name}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function UsualChipButton({
  item,
  busy,
  dragging,
  onAdd,
  onEdit,
  onDragChange,
}: {
  item: Usual;
  busy?: boolean;
  dragging: boolean;
  onAdd: () => void;
  onEdit?: () => void;
  onDragChange: (drag: DragState | null) => void;
}) {
  const mode = useRef<"undecided" | "scroll" | "drag" | "edit">("undecided");
  const origin = useRef<{ x: number; y: number } | null>(null);
  const hold = useRef<number | null>(null);

  function clearHold() {
    if (hold.current) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  }

  function reset() {
    clearHold();
    mode.current = "undecided";
    origin.current = null;
    onDragChange(null);
    setDropActive(false);
  }

  if (item.alreadyOnList) {
    return (
      <span
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg px-3.5 text-sm text-muted select-none"
        aria-label={`${item.name}, already on a list`}
      >
        <Check className="size-3" strokeWidth={2.4} />
        {item.name}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={
        item.defaultListName
          ? `Add ${item.name} to ${item.defaultListName}`
          : `Add ${item.name} to list`
      }
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-fg/20 bg-bg px-3.5 text-sm select-none transition-[background-color,opacity] duration-200 hover:bg-bg-elevated",
        dragging && "opacity-40",
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        origin.current = { x: event.clientX, y: event.clientY };
        mode.current = "undecided";
        if (onEdit) {
          hold.current = window.setTimeout(() => {
            mode.current = "edit";
            hold.current = null;
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate(8);
            }
            onEdit();
          }, 480);
        }
      }}
      onPointerMove={(event) => {
        if (!origin.current) return;
        const dx = event.clientX - origin.current.x;
        const dy = event.clientY - origin.current.y;
        const dist = Math.hypot(dx, dy);

        if (mode.current === "undecided") {
          if (dist < 8) return;
          clearHold();
          if (Math.abs(dx) > Math.abs(dy)) {
            mode.current = "scroll";
            return;
          }
          mode.current = "drag";
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        if (mode.current === "edit") return;
        if (mode.current !== "drag") return;
        event.preventDefault();
        const over = isOverDrop(event.clientX, event.clientY);
        onDragChange({
          id: item.id,
          name: item.name,
          x: event.clientX,
          y: event.clientY,
          over,
        });
      }}
      onPointerUp={(event) => {
        if (!origin.current) return;
        const wasDrag = mode.current === "drag";
        const wasScroll = mode.current === "scroll";
        const wasEdit = mode.current === "edit";
        const over = wasDrag && isOverDrop(event.clientX, event.clientY);
        reset();
        if (wasScroll || wasEdit) return;
        if (wasDrag) {
          if (over) onAdd();
          return;
        }
        onAdd();
      }}
      onPointerCancel={reset}
    >
      <Star className="size-3 fill-fg" />
      {item.name}
    </button>
  );
}
