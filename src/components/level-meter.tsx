import type { InventoryLevel } from "@/lib/constants";
import { INVENTORY_LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const FILL: Record<InventoryLevel, string> = {
  full: "bg-ok",
  ok: "bg-ok/70",
  low: "bg-warn",
  out: "bg-danger",
};

const FILLED: Record<InventoryLevel, number> = {
  out: 1,
  low: 2,
  ok: 3,
  full: 4,
};

export function LevelMeter({
  level,
  onChange,
}: {
  level: InventoryLevel;
  onChange?: (level: InventoryLevel) => void;
}) {
  const filled = FILLED[level];
  return (
    <div className="flex items-center gap-1.5">
      {[...INVENTORY_LEVELS].reverse().map((step, index) => {
        const isOn = index < filled;
        const interactive = Boolean(onChange);
        const Comp = interactive ? "button" : "span";
        return (
          <Comp
            key={step.id}
            type={interactive ? "button" : undefined}
            aria-label={step.label}
            onClick={onChange ? () => onChange(step.id) : undefined}
            className={cn(
              "relative h-2 flex-1 rounded-full transition-colors duration-200",
              isOn ? FILL[level] : "bg-fg/10",
              interactive && "after:absolute after:-inset-y-3 after:inset-x-0",
            )}
          />
        );
      })}
    </div>
  );
}
