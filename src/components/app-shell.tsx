import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Package, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SettingsMenu } from "@/components/settings-menu";
import { PushRegistrar } from "@/components/push-opt-in";
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
  rail,
  dock,
  children,
}: {
  title?: string;
  eyebrow?: string;
  stat?: string;
  actions?: ReactNode;
  back?: ReactNode;
  rail?: ReactNode;
  dock?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col overflow-hidden bg-bg overscroll-y-none">
      <a
        href="#main-content"
        className="sr-only bg-surface px-4 py-2 text-fg focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>

      <header className="edge-top shrink-0 bg-bg px-5 pb-1">
        <div className="flex h-12 items-center justify-between gap-3">
          <Link to="/" className="wordmark" aria-label={`${APP_NAME} home`}>
            {APP_NAME}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {isPending ? (
              <div className="size-9 animate-pulse bg-fill-quiet" />
            ) : (
              <>
                <PushRegistrar />
                <SettingsMenu />
              </>
            )}
          </div>
        </div>
        {back ? <div className="pb-1">{back}</div> : null}
      </header>

      {rail ? (
        <div className="shrink-0 border-b border-hairline bg-bg px-5 py-3">{rail}</div>
      ) : null}

      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
        {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
        {title ? <h1 className="screen-title mt-2">{title}</h1> : null}
        {stat ? <p className="mt-1.5 text-sm text-muted">{stat}</p> : null}
        <div className={title || eyebrow || stat ? "mt-5" : undefined}>{children}</div>
      </main>

      <footer
        className="shrink-0 border-t border-hairline bg-surface/85"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {dock ? <div className="space-y-2 px-5 pt-3 pb-2">{dock}</div> : null}
        <nav aria-label="Main">
          <div className="grid h-[62px] grid-cols-3 pt-2.5">
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
                    "flex flex-col items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase",
                    active ? "text-fg" : "text-subtle",
                  )}
                >
                  <Icon className="size-[21px]" strokeWidth={1.7} />
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
