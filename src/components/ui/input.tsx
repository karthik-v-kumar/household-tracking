import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", onFocus, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-[14px] border border-hairline bg-surface-hi px-3.5 text-base text-fg transition-[border-color,box-shadow] duration-[180ms] placeholder:text-subtle focus-visible:border-fg focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-fg disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onFocus={(event) => {
        onFocus?.(event);
        const target = event.currentTarget;
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: "center", inline: "nearest" });
        });
      }}
      {...props}
    />
  ),
);
Input.displayName = "Input";