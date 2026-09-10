import { useRef, useState } from "react";
import { Check, MoreHorizontal, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;

export function ItemRow({
  item,
  onToggle,
  onStaple,
  onDelete,
}: {
  item: ListItem;
  onToggle: () => void;
  onStaple: () => void;
  onDelete: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"undecided" | "swipe" | "scroll">("undecided");
  const dxRef = useRef(0);
  const committing = useRef(false);
  const [dx, setDx] = useState(0);
  const [snapping, setSnapping] = useState(false);

  function setOffset(value: number) {
    dxRef.current = value;
    setDx(value);
  }

  function reset() {
    start.current = null;
    mode.current = "undecided";
    committing.current = false;
    setSnapping(true);
    setOffset(0);
  }

  function commit(direction: number) {
    const width = rowRef.current?.offsetWidth ?? 390;
    committing.current = true;
    setSnapping(true);
    setOffset(direction > 0 ? width : -width);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
    window.setTimeout(() => {
      onToggle();
      reset();
    }, 200);
  }

  function commitIfNeeded(distance: number) {
    if (Math.abs(distance) >= THRESHOLD) commit(distance);
    else reset();
  }

  const swiping = Math.abs(dx) > 8;
  const note = item.notes?.trim() ?? "";
  const source = /inventory/i.test(note)
    ? "From inventory"
    : /filter/i.test(note)
      ? "From filters"
      : note || null;

  return (
    <div ref={rowRef} className="swipe-row border-b border-hairline last:border-0">
      <div
        className={cn("swipe-row-action", item.checked ? "is-undo" : "is-buy")}
        aria-hidden="true"
      >
        {item.checked ? "Put back" : "Got it"}
      </div>
      <div
        className={cn(
          "swipe-row-front flex h-14 items-center gap-3 px-0",
          item.checked && "is-checked",
          snapping && "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{ transform: `translate3d(${dx}px, 0, 0)` }}
        onTransitionEnd={() => setSnapping(false)}
        onPointerDown={(event) => {
          if (event.button !== 0 || committing.current) return;
          start.current = { x: event.clientX, y: event.clientY };
          mode.current = "undecided";
          setSnapping(false);
        }}
        onPointerMove={(event) => {
          if (!start.current || committing.current) return;
          const rawX = event.clientX - start.current.x;
          const rawY = event.clientY - start.current.y;
          if (mode.current === "undecided") {
            if (Math.hypot(rawX, rawY) < 8) return;
            if (Math.abs(rawY) > Math.abs(rawX)) {
              mode.current = "scroll";
              return;
            }
            mode.current = "swipe";
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (mode.current !== "swipe") return;
          event.preventDefault();
          const width = rowRef.current?.offsetWidth ?? 390;
          setOffset(Math.max(-width, Math.min(width, rawX)));
        }}
        onPointerUp={() => {
          if (!start.current || committing.current) return;
          const distance = dxRef.current;
          const wasSwipe = mode.current === "swipe";
          if (wasSwipe) commitIfNeeded(distance);
          else reset();
        }}
        onPointerCancel={() => {
          if (!committing.current) reset();
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (committing.current || swiping) return;
            onToggle();
          }}
          aria-pressed={item.checked}
          aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
          className="grid size-11 shrink-0 place-items-center"
        >
          <span
            className={cn(
              "grid size-[22px] place-items-center rounded-full border-[1.5px] transition-colors duration-[180ms]",
              item.checked
                ? "border-fg bg-fg text-primary-fg"
                : "border-fg/20 bg-transparent text-transparent",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (committing.current || swiping) return;
            onToggle();
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn("truncate text-base font-medium tracking-[-0.012em]", item.checked && "text-muted line-through")}>
            {item.name}
          </p>
        </button>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 transition-opacity duration-150",
            swiping && "pointer-events-none opacity-0",
          )}
        >
          {item.quantity ? (
            <span className="text-[13px] tabular-nums text-subtle">{item.quantity}</span>
          ) : null}
          {source ? <span className="status text-accent">{source}</span> : null}
          {item.isStaple ? (
            <Star className="size-3.5 shrink-0 fill-fg text-fg" />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center text-muted hover:bg-fg/6 hover:text-fg"
                aria-label={`More for ${item.name}`}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onStaple}>
                {item.isStaple ? "Remove from usuals" : "Remember as usual"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={onDelete}>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
