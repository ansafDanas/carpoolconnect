import { Car, Leaf, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Two-column frame shared by sign in, sign up and password recovery, so all
 * four screens speak with one voice. The left panel states the product idea
 * plainly: shared journeys and split fuel, never a taxi.
 */
const HIGHLIGHTS = [
  {
    icon: Users,
    title: "Real people, real profiles",
    body: "Ratings, reviews and safety controls on every journey.",
  },
  {
    icon: Leaf,
    title: "Split the fuel, not a fare",
    body: "You contribute to the cost of the trip, nothing more.",
  },
  {
    icon: ShieldCheck,
    title: "Safety comes first",
    body: "Blocking, reporting and women-only rides, built in.",
  },
];

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(242,169,59,0.45), transparent 45%), radial-gradient(circle at 85% 80%, rgba(46,125,98,0.5), transparent 50%)",
          }}
          aria-hidden="true"
        />

        <Link to="/landing" className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-marigold text-primary">
            <Car className="size-6" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-tight">
              CarpoolConnect
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
              Share the journey
            </span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-[1.1] tracking-[-0.02em]">
            Share the journey.
            <br />
            Make travel better.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-white/65">
            Find people going your way, share the ride, and split the fuel cost. A
            carpool community built for Kerala.
          </p>

          <ul className="mt-9 grid gap-4">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-marigold"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-white/55">
                      {item.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          A social carpool platform, not a taxi service.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            to="/landing"
            className="mb-8 flex items-center gap-2.5 lg:hidden"
            aria-label="CarpoolConnect home"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-leaf text-marigold">
              <Car className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-bold text-primary">
              CarpoolConnect
            </span>
          </Link>

          <h1 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-primary sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">{subtitle}</p>
          ) : null}

          <div className="mt-7 grid gap-5">{children}</div>

          {footer ? <div className="mt-7">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
export { AuthLayout };
