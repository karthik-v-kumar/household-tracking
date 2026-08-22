import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "bg-surface text-fg border-border shadow-[var(--shadow-card)]",
        },
      }}
    />
  );
}
