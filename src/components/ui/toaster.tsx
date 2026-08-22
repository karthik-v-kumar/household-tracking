import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "panel bg-surface text-fg border-border",
        },
      }}
    />
  );
}
