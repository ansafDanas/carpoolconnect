import { Link } from "react-router-dom";
import heroImage from "../assets/carpool-commute-hero.png";
import heroImage480 from "../assets/carpool-commute-hero-480.webp";
import heroImage768 from "../assets/carpool-commute-hero-768.webp";
import heroImage1024 from "../assets/carpool-commute-hero-1024.webp";
import heroImage1264 from "../assets/carpool-commute-hero-1264.webp";

function FuelTicker({ price }) {
  if (!price) return null;
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur">
      <span className="text-xl" aria-hidden="true">⛽</span>
      <div className="leading-tight">
        <p className="text-sm font-extrabold text-white">
          ₹{Number(price.petrol).toFixed(2)}
          <span className="text-white/60">/litre</span>
        </p>
        <p className="text-[11px] text-white/60">
          25 km costs about ₹{Math.round(price.sample?.fuelCost || 0)} in fuel
        </p>
      </div>
    </div>
  );
}

function HeroSection({ fuelPrice }) {
  return (
    <section className="relative isolate overflow-hidden bg-primary">
      <picture>
        <source type="image/webp" srcSet={`${heroImage480} 480w, ${heroImage768} 768w, ${heroImage1024} 1024w, ${heroImage1264} 1264w`} sizes="100vw" />
        <img src={heroImage} alt="Friends sharing a car on their city commute" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-25 grayscale" width="1264" height="848" fetchPriority="high" />
      </picture>
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary via-primary/95 to-primary/70" />
      <div className="absolute -right-32 -top-32 -z-10 h-[32rem] w-[32rem] rounded-full bg-marigold/15 blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 -z-10 h-96 w-96 rounded-full bg-leaf/20 blur-3xl" />

      <div className="mx-auto grid min-h-[660px] max-w-7xl items-end gap-14 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:px-10 lg:py-24">
        <div className="max-w-2xl text-white">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-marigold/40 bg-marigold/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-marigold">
            <span className="h-2 w-2 rounded-full bg-marigold" />
            Ride together, not a taxi
          </div>

          <p className="mb-5 inline-block -rotate-1 rounded-2xl bg-marigold px-4 py-2 font-display text-lg font-bold text-primary shadow-lg sm:text-xl">
            No yellow board. No police fine. No awkward meter argument.
          </p>

          <h1 className="max-w-2xl text-5xl font-black leading-[.98] tracking-[-0.04em] sm:text-6xl">
            Same road.
            <br />
            <span className="text-marigold">New people.</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-white/70">
            Share the fuel, skip the fare, and end up with someone to talk to.
            Everyone here is a person driving their own car, going their own way.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-2xl bg-leaf px-6 py-3.5 text-sm font-extrabold text-white shadow-glow transition hover:-translate-y-1">
              Find your ride <span aria-hidden="true">→</span>
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-white/10">
              I already ride
            </Link>
            <FuelTicker price={fuelPrice} />
          </div>
        </div>

        <div className="hidden justify-self-end lg:block">
          <div className="w-[360px] -rotate-1 rounded-[28px] border border-white/15 bg-white p-6 text-primary shadow-elevated">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-leaf">How it works</p>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight">Split the fuel, not the fare.</h2>
            <div className="mt-5 space-y-4">
              {[
                { icon: "🚗", title: "Someone posts their route", text: "They are driving there anyway." },
                { icon: "⛽", title: "You cover the petrol", text: "The app does the maths for you." },
                { icon: "☕", title: "Add coffee if you want", text: "Entirely optional, never expected." },
              ].map((row) => (
                <div className="flex items-start gap-3" key={row.title}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-lg">{row.icon}</span>
                  <div>
                    <p className="text-sm font-extrabold">{row.title}</p>
                    <p className="text-xs leading-5 text-text-muted">{row.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
