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
  stat,
  actions,
  back,
  dock,
  children,
}: {
  title?: string;
  eyebrow?: string;
  stat?: string;
  actions?: ReactNode;
  back?: ReactNode;
  dock?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const user = useCurrentUser();

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col overflow-hidden bg-bg overscroll-y-none">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-surface px-4 py-2 text-fg focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>

      <header className="edge-top shrink-0 border-b border-border/80 bg-bg px-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="wordmark" aria-label={`${APP_NAME} home`}>
            {APP_NAME}
          </Link>
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
        {back ? <div className="mt-3">{back}</div> : null}
      </header>

      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-6">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <h1 className="mt-1 font-display text-4xl leading-[1.05] tracking-tight">{title}</h1>
        ) : null}
        {stat ? <p className="mt-2 text-sm text-muted">{stat}</p> : null}
        <div className={title || eyebrow || stat ? "mt-6" : undefined}>{children}</div>
      </main>

      <footer
        className="shrink-0 border-t border-border bg-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {dock ? <div className="space-y-2 px-4 pt-3 pb-2">{dock}</div> : null}
        <nav aria-label="Main">
          <div className="grid grid-cols-3">
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
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs tracking-wide",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.1 : 1.6} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </footer>
    </div>
  );
}
