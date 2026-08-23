import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type UsualChip = {
  id: number;
  name: string;
  alreadyOnList: boolean;
};

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
  onDraggingChange,
  busy,
}: {
  usuals: UsualChip[];
  onAdd: (name: string) => void;
  onAddRemaining?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  busy?: boolean;
}) {
  const ordered = [
    ...usuals.filter((item) => !item.alreadyOnList),
    ...usuals.filter((item) => item.alreadyOnList),
  ];
  const missing = ordered.filter((item) => !item.alreadyOnList);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    onDraggingChange?.(Boolean(drag));
    setDropActive(Boolean(drag?.over));
    return () => setDropActive(false);
  }, [drag, onDraggingChange]);

  if (usuals.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <p className="shrink-0 text-xs font-medium tracking-[0.16em] text-muted uppercase">Tray</p>
      <div className="chip-tray min-w-0 flex-1" aria-label="Usuals tray">
        {ordered.map((item) => (
          <UsualChipButton
            key={item.id}
            item={item}
            busy={busy}
            dragging={drag?.id === item.id}
            onAdd={() => onAdd(item.name)}
            onDragChange={setDrag}
          />
        ))}
      </div>
      {missing.length > 0 && onAddRemaining ? (
        <button
          type="button"
          className="civic-link shrink-0 text-xs text-muted hover:text-fg disabled:opacity-50"
          disabled={busy}
          onClick={onAddRemaining}
        >
          {missing.length === 1 ? "Add" : `Add ${missing.length}`}
        </button>
      ) : null}
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
  onDragChange,
}: {
  item: UsualChip;
  busy?: boolean;
  dragging: boolean;
  onAdd: () => void;
  onDragChange: (drag: DragState | null) => void;
}) {
  const mode = useRef<"undecided" | "scroll" | "drag">("undecided");
  const origin = useRef<{ x: number; y: number } | null>(null);

  function reset() {
    mode.current = "undecided";
    origin.current = null;
    onDragChange(null);
    setDropActive(false);
  }

  if (item.alreadyOnList) {
    return (
      <span
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg px-3.5 text-sm text-muted select-none"
        aria-label={`${item.name}, already on list`}
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
      aria-label={`Add ${item.name} to list`}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-fg/20 bg-bg px-3.5 text-sm select-none transition-[background-color,opacity] duration-200 hover:bg-bg-elevated",
        dragging && "opacity-40",
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        origin.current = { x: event.clientX, y: event.clientY };
        mode.current = "undecided";
      }}
      onPointerMove={(event) => {
        if (!origin.current) return;
        const dx = event.clientX - origin.current.x;
        const dy = event.clientY - origin.current.y;
        const dist = Math.hypot(dx, dy);

        if (mode.current === "undecided") {
          if (dist < 8) return;
          if (Math.abs(dx) > Math.abs(dy)) {
            mode.current = "scroll";
            return;
          }
          mode.current = "drag";
          event.currentTarget.setPointerCapture(event.pointerId);
        }

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
        const over = wasDrag && isOverDrop(event.clientX, event.clientY);
        reset();
        if (wasScroll) return;
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
