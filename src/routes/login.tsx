import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginPending, LoginScreen } from "@/components/login-screen";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <LoginPending />;
  if (user) return <Navigate to="/" />;
  return <LoginScreen />;
}
