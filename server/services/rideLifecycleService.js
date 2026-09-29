import Ride from "../models/Ride.js";
import Booking from "../models/Booking.js";
import RideRequest from "../models/RideRequest.js";
import Notification from "../models/Notification.js";

/**
 * Reviews are hard-gated on a completed ride, so anything left active after
 * its departure time would silently block rating forever.
 *
 * This is called from two places so completion never depends on another user
 * browsing the public list:
 *  - a timer started by the server process (see startRideLifecycleScheduler)
 *  - the public ride listing, as a safety net if the timer has not run yet
 *
 * The claim is a conditional write, so repeated invocations are safe and
 * cannot double-complete a ride.
 */
export const autoCompleteDueRides = async ({ graceMinutes = 120 } = {}) => {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

  const dueRides = await Ride.find({
    status: "active",
    date: { $lte: cutoff },
  }).select("_id date source destination");

  if (!dueRides.length) {
    return { completed: 0 };
  }

  const completedRideIds = [];

  for (const ride of dueRides) {
    const rideId = ride._id;

    // Re-check with a conditional write so a concurrent cancellation
    // or manual completion cannot be overwritten.
    const claimed = await Ride.findOneAndUpdate(
      { _id: rideId, status: "active" },
      { $set: { status: "completed", trackingActive: false } },
      { returnDocument: "after" }
    );

    if (!claimed) {
      continue;
    }

    completedRideIds.push(rideId);

    // A request that had been matched to this ride is no longer actionable,
    // so it is released rather than left pointing at a finished trip.
    await RideRequest.updateMany(
      { matchedRide: rideId, status: "matched" },
      { $set: { status: "open" }, $unset: { matchedRide: 1 } }
    );

    const bookings = await Booking.find({
      ride: rideId,
      status: "confirmed",
    }).select("_id passenger");

    await Promise.allSettled(
      bookings.map((booking) =>
        Notification.create({
          recipient: booking.passenger,
          type: "ride_completed",
          title: "How was your ride?",
          message: `Your trip from ${ride.source} to ${ride.destination} is complete. Leave a review for your travel buddy.`,
          relatedRide: rideId,
          relatedBooking: booking._id,
        })
      )
    );
  }

  return { completed: completedRideIds.length };
};

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

let schedulerTimer = null;

/**
 * Starts the in-process completion timer. It is unref'd so it never keeps the
 * process alive on shutdown, and it refuses to start twice so a hot reload
 * cannot create overlapping loops.
 */
export const startRideLifecycleScheduler = ({
  intervalMs = DEFAULT_INTERVAL_MS,
  graceMinutes = 120,
} = {}) => {
  if (schedulerTimer) {
    return schedulerTimer;
  }

  const run = () => {
    autoCompleteDueRides({ graceMinutes }).catch((error) => {
      console.error("Ride auto-completion error:", error.message);
    });
  };

  run();
  schedulerTimer = setInterval(run, intervalMs);
  schedulerTimer.unref?.();

  return schedulerTimer;
};

export const stopRideLifecycleScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
};