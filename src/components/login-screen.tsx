import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";

export function LoginPending() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-16">
      <p className="wordmark w-fit">{APP_NAME}</p>
      <p className="mt-10 text-muted">Loading your session…</p>
    </main>
  );
}

export function LoginScreen({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0] || "Household",
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message || "Could not create account");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: true,
        });
        if (err) throw new Error(err.message || "Could not sign in");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      <header className="flex items-center px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <Link to="/" className="wordmark" aria-label={`${APP_NAME} home`}>
          {APP_NAME}
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center px-5 pb-12 pt-4">
        <div className="relative mx-auto w-full max-w-md">
          <figure className="still-life">
            <img
              src="/images/produce.jpg"
              alt="Swiss chard, lemons, vine tomatoes, and a carton of brown eggs"
              width={1400}
              height={1050}
              className="aspect-[4/3] w-full object-cover"
            />
          </figure>

          <div className="overlay-surface relative z-10 -mt-16 mx-2 p-5 sm:mx-4">
            <h1 className="font-display text-3xl leading-[1.1] tracking-tight">
              {mode === "signup" ? "Start the household." : "The lists you both keep."}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {mode === "signup"
                ? "Grocery, warehouse, pharmacy — shared from the first list you add."
                : "Pick up grocery, warehouse, and the rest of the house from this phone."}
            </p>

            <div className="mt-5">
              {!authEnabled ? (
                <p className="text-sm text-muted">Sign-in is disabled.</p>
              ) : (
                <>
                  <div className="grid gap-2">
                    {GROK_PROVIDERS.map((provider) => (
                      <Button
                        key={provider.providerId}
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
                      >
                        Continue with {provider.label}
                      </Button>
                    ))}
                  </div>

                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs tracking-[0.14em] text-subtle uppercase">or email</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form className="grid gap-3" onSubmit={onEmailSubmit}>
                    {mode === "signup" ? (
                      <div className="grid gap-1.5">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Alex"
                        />
                      </div>
                    ) : null}
                    <div className="grid gap-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    {error ? <p className="text-sm text-danger">{error}</p> : null}
                    <Button type="submit" className="mt-1 w-full" disabled={busy}>
                      {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                    </Button>
                  </form>

                  <button
                    type="button"
                    className="civic-link mt-5 w-full text-center text-sm text-muted hover:text-fg"
                    onClick={() => {
                      setMode(mode === "signup" ? "signin" : "signup");
                      setError(null);
                    }}
                  >
                    {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
