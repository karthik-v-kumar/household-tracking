import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "overlay-surface bg-surface text-fg border-border",
        },
      }}
    />
  );
}
