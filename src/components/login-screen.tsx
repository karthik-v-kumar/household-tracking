import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";

const CATALOG = [
  {
    src: "/images/paper.jpg",
    alt: "Unbranded paper towels and toilet paper on a cream surface",
    caption: "The house",
  },
  {
    src: "/images/filter.jpg",
    alt: "A pleated furnace air filter standing on a cream surface",
    caption: "Filters",
  },
  {
    src: "/images/pharmacy.jpg",
    alt: "An amber vitamin bottle, a white pill bottle, and a few tablets",
    caption: "Pharmacy",
  },
] as const;

const BEATS = [
  {
    title: "Lists by store",
    body: "Grocery, warehouse, pharmacy — or Costco, Target, the farmers market. Add and delete freely.",
  },
  {
    title: "This week's usuals",
    body: "Star what you buy often. Tap only what you need; leave the rest on the tray.",
  },
  {
    title: "The house keeps score",
    body: "Pantry levels and filter schedules. Empty shelves write themselves onto a list.",
  },
];

export function LoginPending() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-16">
      <p className="wordmark w-fit">{APP_NAME}</p>
      <p className="mt-10 text-muted">Loading your session…</p>
    </main>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-16">
      <a href="#signin" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
        Skip to sign in
      </a>
      <p className="wordmark w-fit">{APP_NAME}</p>

      <h1 className="mt-8 font-display text-[2.65rem] leading-[1.05] tracking-tight sm:text-5xl">
        Weekend lists.
        <br />
        A pantry that remembers.
      </h1>

      <figure className="still-life mt-7">
        <img
          src="/images/produce.jpg"
          alt="Swiss chard, lemons, vine tomatoes, and a carton of brown eggs"
          width={1400}
          height={1050}
          className="aspect-[4/3] w-full object-cover"
        />
      </figure>

      <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
        Two phones, one household. Shop by store, tap in this week's usuals, and let
        empty shelves write themselves onto a list.
      </p>

      <ul className="mt-6 grid grid-cols-3 gap-2.5">
        {CATALOG.map((item) => (
          <li key={item.src}>
            <figure>
              <div className="still-life">
                <img
                  src={item.src}
                  alt={item.alt}
                  width={900}
                  height={900}
                  className="aspect-square w-full object-cover"
                />
              </div>
              <figcaption className="mt-2 text-xs font-medium tracking-[0.08em] text-muted uppercase">
                {item.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <section id="signin" className="mt-8">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          {mode === "signup" ? "Create an account" : "Sign in"}
        </p>
        <div className="panel mt-3 p-5">
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
      </section>

      <ul className="mt-10 grid gap-5">
        {BEATS.map((beat) => (
          <li key={beat.title}>
            <p className="font-medium">{beat.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{beat.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-xs leading-relaxed text-subtle">
        One household, two phones. Stay signed in after the first login.
      </p>
    </main>
  );
}
