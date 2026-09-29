/**
 * Small fixed-window rate limiter.
 *
 * Deliberately dependency-free so the production bundle gains no new supply
 * chain surface. It tracks counters per client key in memory, which is the
 * right trade-off for a single-instance deployment; behind more than one
 * instance each would hold its own window, which is still better than none.
 */

const WINDOW_MS = 15 * 60 * 1000;

const buckets = new Map();

const clientKey = (req) =>
  (req.user && req.user._id ? String(req.user._id) : null) ||
  req.ip ||
  "unknown";

// Periodically drop expired buckets so the map cannot grow without bound.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, WINDOW_MS);

// Never hold the process open just to clear a cache.
sweeper.unref?.();

/**
 * @param {{ windowMs?: number, max?: number, message?: string, keyPrefix?: string }} options
 */
const createRateLimiter = ({
  windowMs = WINDOW_MS,
  max = 30,
  message = "Too many requests. Please wait a moment and try again.",
  keyPrefix = "rl",
} = {}) => (req, res, next) => {
  const now = Date.now();
  const key = `${keyPrefix}:${clientKey(req)}`;

  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, max - bucket.count);

  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));

    return res.status(429).json({
      success: false,
      message,
    });
  }

  return next();
};

/** Clears every tracked window. Used by the test harness between cases. */
export const resetRateLimits = () => {
  buckets.clear();
};

/** Tighter windows for the unauthenticated credential endpoints. */
export const authLimiter = createRateLimiter({
  max: 10,
  keyPrefix: "auth",
  message: "Too many attempts. Please wait a few minutes and try again.",
});

export const passwordResetLimiter = createRateLimiter({
  max: 5,
  keyPrefix: "pwreset",
  message: "Too many password reset requests. Please wait before trying again.",
});

export const writeLimiter = createRateLimiter({
  max: 60,
  keyPrefix: "write",
});

export default createRateLimiter;
