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
const MAX = 132;

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
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"undecided" | "swipe" | "scroll">("undecided");
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [snapping, setSnapping] = useState(false);

  function setOffset(value: number) {
    dxRef.current = value;
    setDx(value);
  }

  function reset() {
    start.current = null;
    mode.current = "undecided";
    setSnapping(true);
    setOffset(0);
  }

  function commitIfNeeded(distance: number) {
    if (Math.abs(distance) >= THRESHOLD) {
      onToggle();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(8);
      }
    }
    reset();
  }

  return (
    <div className="swipe-row border-b border-hairline last:border-0">
      <div
        className={cn("swipe-row-action", item.checked ? "is-undo" : "is-buy")}
        aria-hidden="true"
      >
        {item.checked ? "Put back" : "Got it"}
      </div>
      <div
        className={cn(
          "swipe-row-front flex items-center gap-3 px-1 py-1",
          item.checked && "opacity-55",
          snapping && "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{ transform: `translate3d(${dx}px, 0, 0)` }}
        onTransitionEnd={() => setSnapping(false)}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          start.current = { x: event.clientX, y: event.clientY };
          mode.current = "undecided";
          setSnapping(false);
        }}
        onPointerMove={(event) => {
          if (!start.current) return;
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
          const clamped = Math.max(-MAX, Math.min(MAX, rawX));
          setOffset(clamped);
        }}
        onPointerUp={() => {
          if (!start.current) return;
          const distance = dxRef.current;
          const wasSwipe = mode.current === "swipe";
          if (wasSwipe) commitIfNeeded(distance);
          else reset();
        }}
        onPointerCancel={reset}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={item.checked}
          aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
          className="grid size-11 shrink-0 place-items-center"
        >
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full border transition-colors duration-200",
              item.checked
                ? "border-fg bg-fg text-primary-fg"
                : "border-fg/25 bg-transparent text-transparent",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 py-2 text-left">
          <p className={cn("truncate text-[0.98rem] font-semibold tracking-tight", item.checked && "text-muted line-through")}>
            {item.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {[item.quantity, item.isStaple ? "Usual" : null, item.notes]
              .filter(Boolean)
              .join(" · ")}
            {!item.quantity && !item.isStaple && !item.notes ? "Swipe to mark bought" : null}
          </p>
        </button>
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
  );
}
