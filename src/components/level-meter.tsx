import { Minus, Plus } from "lucide-react";
import type { InventoryLevel } from "@/lib/constants";
import { INVENTORY_LEVELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILL: Record<InventoryLevel, string> = {
  full: "bg-ok",
  ok: "bg-ok/70",
  low: "bg-warn",
  out: "bg-danger",
};

const ORDER: InventoryLevel[] = ["out", "low", "ok", "full"];

function step(level: InventoryLevel, dir: -1 | 1): InventoryLevel {
  const index = ORDER.indexOf(level);
  const next = Math.max(0, Math.min(ORDER.length - 1, index + dir));
  return ORDER[next] ?? level;
}

export function LevelMeter({
  level,
  onChange,
}: {
  level: InventoryLevel;
  onChange?: (level: InventoryLevel) => void;
}) {
  const filled = ORDER.indexOf(level) + 1;
  const interactive = Boolean(onChange);

  return (
    <div className="flex items-center gap-2">
      {interactive ? (
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="Lower level"
          disabled={level === "out"}
          onClick={() => onChange?.(step(level, -1))}
        >
          <Minus className="size-3.5" />
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {ORDER.map((id, index) => {
          const isOn = index < filled;
          const Comp = interactive ? "button" : "span";
          const label = INVENTORY_LEVELS.find((row) => row.id === id)?.label ?? id;
          return (
            <Comp
              key={id}
              type={interactive ? "button" : undefined}
              aria-label={label}
              aria-pressed={interactive ? id === level : undefined}
              onClick={onChange ? () => onChange(id) : undefined}
              className={cn(
                "relative h-5 flex-1 rounded-full transition-colors duration-200",
                isOn ? FILL[level] : "bg-fg/10",
                interactive && "after:absolute after:-inset-y-3 after:inset-x-0",
              )}
            />
          );
        })}
      </div>
      {interactive ? (
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="Raise level"
          disabled={level === "full"}
          onClick={() => onChange?.(step(level, 1))}
        >
          <Plus className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
