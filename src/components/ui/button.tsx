import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-tight transition-[opacity,background-color,color,border-color] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:opacity-90",
        secondary: "border border-fg/14 bg-transparent text-fg-2 hover:bg-fill-row",
        outline: "border border-fg/14 bg-transparent text-fg-2 hover:bg-fill-row",
        ghost: "border border-transparent text-muted hover:bg-fill-row hover:text-fg",
        danger: "bg-danger text-primary-fg hover:opacity-90",
        accent: "bg-accent text-accent-fg hover:opacity-90",
      },
      size: {
        default: "h-12 rounded-[14px] px-5 text-[15px]",
        sm: "h-8 rounded-full px-3.5 text-[13px]",
        lg: "h-12 rounded-[14px] px-6 text-[15px]",
        icon: "size-9 rounded-[10px]",
        "icon-sm": "size-9 rounded-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };