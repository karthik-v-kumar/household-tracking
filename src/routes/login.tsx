import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginPending, LoginScreen } from "@/components/login-screen";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const initialMode = search.includes("mode=signup") ? "signup" : "signin";
  if (isPending) return <LoginPending />;
  if (user) return <Navigate to="/" />;
  return <LoginScreen initialMode={initialMode} />;
}
