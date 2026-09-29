import { Link } from "react-router-dom";

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <section className="relative w-full max-w-2xl overflow-hidden rounded-[36px] bg-primary px-7 py-14 text-center text-white shadow-2xl shadow-primary/20 sm:px-14">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-accent/25" />
        <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-lime/15 blur-2xl" />
        <p className="relative text-8xl font-black tracking-[-0.1em] text-lime">404</p>
        <p className="relative mt-4 text-xs font-black uppercase tracking-[0.2em] text-accent">Wrong turn</p>
        <h1 className="relative mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">This ride went somewhere else.</h1>
        <p className="relative mx-auto mt-4 max-w-md text-sm leading-7 text-white/60">The page you requested does not exist or may have moved. Let&apos;s get you back to the good stuff.</p>
        <Link to="/" className="relative mt-8 inline-flex rounded-2xl bg-lime px-5 py-3 text-sm font-black text-primary transition hover:-translate-y-1">Back to CarpoolConnect ↗</Link>
      </section>
    </main>
  );
}

export default NotFound;
