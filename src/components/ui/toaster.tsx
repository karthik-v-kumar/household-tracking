import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "overlay-surface bg-surface text-fg border-border",
          actionButton:
            "!rounded-full !bg-primary !text-primary-fg !px-3 !py-1 !text-sm !font-semibold",
          cancelButton: "!text-muted",
        },
      }}
    />
  );
}
