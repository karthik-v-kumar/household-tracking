import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";

const CATALOG = [
  {
    src: "/images/paper.jpg",
    alt: "Unbranded paper towels and toilet paper on a cream surface",
    caption: "Paper goods",
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
    title: "A list for each store",
    body: "Grocery. The warehouse. The pharmacy. Add Costco or the farmers market; drop the ones you never use.",
  },
  {
    title: "Usuals, not the whole catalog",
    body: "Milk and eggs live in a tray on that list. Tap what you need this week. Leave the rest.",
  },
  {
    title: "The shelf keeps its own count",
    body: "Paper on low. A furnace filter due in twelve days. If you have no spare, it's already on a list.",
  },
];

export function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-xl bg-bg">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <p className="wordmark">{APP_NAME}</p>
        <Link to="/login" className={buttonVariants({ size: "sm" })}>
          Log in or sign up
        </Link>
      </header>

      <main className="px-5 pb-[max(4.5rem,calc(2rem+env(safe-area-inset-bottom)))]">
        <h1 className="mt-8 font-display text-[2.65rem] leading-[1.05] tracking-tight sm:text-5xl">
          What to buy.
          <br />
          What's at home.
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
          Two phones, one kitchen. A list for each store you shop — and a record of
          the paper, the filters, and whatever else lives on the shelf.
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

        <p className="mt-10 max-w-md text-base leading-relaxed">
          You shouldn't have to type milk in again every Saturday.
        </p>

        <div className="mt-6 flex flex-col items-start gap-3">
          <Link to="/login" className={buttonVariants()}>
            Log in or sign up
          </Link>
          <p className="text-xs leading-relaxed text-subtle">
            Both of you stay signed in. The lists stay in sync.
          </p>
        </div>
      </main>
    </div>
  );
}
