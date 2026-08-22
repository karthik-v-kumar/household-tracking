import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Package, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Lists", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/household", label: "Household", icon: Users },
] as const;

export function AppShell({
  title,
  eyebrow,
  actions,
  children,
}: {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const user = useCurrentUser();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/90 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
            {eyebrow ?? APP_NAME}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {isPending ? (
              <div className="size-9 animate-pulse rounded-full bg-fg/8" />
            ) : user ? (
              <div className="[&>div]:gap-1.5 [&_span.text-sm.font-medium]:hidden [&_button]:text-xs">
                <UserButton />
              </div>
            ) : null}
          </div>
        </div>
        {title ? (
          <h1 className="mt-2 truncate font-display text-3xl leading-none font-medium tracking-tight">
            {title}
          </h1>
        ) : null}
      </header>

      <main className="flex-1 px-5 py-5">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-surface/95 backdrop-blur-sm"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/" || pathname.startsWith("/lists")
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
