import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";

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

export function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/80 bg-bg px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <p className="wordmark">{APP_NAME}</p>
        <Link to="/login" className={buttonVariants({ size: "sm" })}>
          Log in or sign up
        </Link>
      </header>

      <main className="px-5 pb-16">
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

        <ul className="mt-10 grid gap-5">
          {BEATS.map((beat) => (
            <li key={beat.title}>
              <p className="font-medium">{beat.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{beat.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-start gap-3">
          <Link to="/login" className={buttonVariants()}>
            Log in or sign up
          </Link>
          <p className="text-xs leading-relaxed text-subtle">
            One household, two phones. Stay signed in after the first login.
          </p>
        </div>
      </main>
    </div>
  );
}
