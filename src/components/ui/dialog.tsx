import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import { forwardRef, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

function useVisualViewportVars() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const apply = () => {
      const height = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      const bottom = Math.max(0, window.innerHeight - top - height);
      root.style.setProperty("--vv-top", `${Math.round(top)}px`);
      root.style.setProperty("--vv-height", `${Math.round(height)}px`);
      root.style.setProperty("--vv-bottom", `${Math.round(bottom)}px`);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--vv-top");
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-bottom");
    };
  }, []);
}

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[70] bg-fg/35 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  useVisualViewportVars();
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "overlay-surface dialog-sheet z-[80] flex flex-col overflow-hidden text-fg focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-fg/15" aria-hidden="true" />
        <div className="dialog-sheet-body">{children}</div>
        <DialogPrimitive.Close className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-fill-quiet text-muted hover:text-fg">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 pr-10", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-[22px] font-semibold tracking-[-0.02em] text-fg", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-sm text-muted", className)}
      {...props}
    />
  );
}
