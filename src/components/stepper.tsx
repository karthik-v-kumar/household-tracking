import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  suffix,
  editable,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  editable?: boolean;
}) {
  function clamp(next: number) {
    if (!Number.isFinite(next)) return min;
    return Math.min(max, Math.max(min, Math.round(next)));
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex h-11 items-center justify-between gap-1 rounded-md border border-border bg-bg px-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          <Minus className="size-3.5" />
        </Button>
        {editable ? (
          <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
            <Input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={Number.isFinite(value) ? value : ""}
              onChange={(event) => onChange(clamp(Number(event.target.value)))}
              className="h-9 w-20 border-0 bg-transparent px-0 text-center text-sm font-medium tabular-nums shadow-none focus-visible:ring-0"
            />
            {suffix ? <span className="text-xs text-muted">{suffix}</span> : null}
          </div>
        ) : (
          <span className="min-w-6 text-center text-sm font-medium tabular-nums">
            {value}
            {suffix ? <span className="ml-1 text-xs font-normal text-muted">{suffix}</span> : null}
          </span>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
