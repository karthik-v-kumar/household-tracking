import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,background-color,color,border-color] duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:opacity-90",
        secondary: "border border-fg/20 bg-surface text-fg hover:bg-bg-elevated",
        outline: "border border-fg/40 bg-transparent text-fg hover:bg-fg/5",
        ghost: "text-fg hover:bg-fg/6",
        danger: "bg-danger text-primary-fg hover:opacity-90",
      },
      size: {
        default: "h-11 rounded-full px-5 text-sm",
        sm: "h-9 rounded-full px-3.5 text-sm",
        lg: "h-12 rounded-full px-6 text-base",
        icon: "size-11 rounded-full",
        "icon-sm": "size-9 rounded-full",
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
