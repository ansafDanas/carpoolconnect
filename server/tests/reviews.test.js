import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, Ride, Booking, Review, Notification, createdUserIds, createdRideIds, createdBookingIds, makeUniqueEmail } from "./setup.js";

describe("Review API", () => {
  it("valid review creation succeeds and updates driver rating", async () => {
    const driver = await User.create({
      name: "Review Driver",
      email: makeUniqueEmail("review-driver"),
      password: "secret123",
      role: "driver",
      rating: 5,
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Review Passenger",
      email: makeUniqueEmail("review-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Review Source",
      destination: "Review Destination",
      date: new Date(Date.now() - 172800000),
      seatsAvailable: 2,
      price: 180,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 4,
        comment: "Good trip",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.rating).toBe(4);
    expect(response.body.updatedRating).toBe(4);

    const updatedUser = await User.findById(driver._id);
    expect(updatedUser.rating).toBe(4);
  });

  it("duplicate review rejection is enforced", async () => {
    const driver = await User.create({
      name: "Duplicate Review Driver",
      email: makeUniqueEmail("duplicate-review-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Duplicate Review Passenger",
      email: makeUniqueEmail("duplicate-review-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Dup Review Source",
      destination: "Dup Review Destination",
      date: new Date(Date.now() - 259200000),
      seatsAvailable: 2,
      price: 200,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const firstResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 5,
        comment: "Great",
      });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 3,
        comment: "Again",
      });

    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.message).toMatch(/already been reviewed|already/i);
  });

  it("invalid rating and cancelled booking reviews are rejected", async () => {
    const driver = await User.create({
      name: "Rating Driver",
      email: makeUniqueEmail("rating-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Rating Passenger",
      email: makeUniqueEmail("rating-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const completedRide = await Ride.create({
      driver: driver._id,
      source: "Rating Source",
      destination: "Rating Destination",
      date: new Date(Date.now() - 345600000),
      seatsAvailable: 2,
      price: 150,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(completedRide._id);

    const completedBooking = await Booking.create({
      passenger: passenger._id,
      ride: completedRide._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(completedBooking._id);

    const invalidRatingResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: completedRide._id.toString(),
        bookingId: completedBooking._id.toString(),
        rating: 6,
        comment: "Bad rating",
      });

    expect(invalidRatingResponse.status).toBe(400);
    expect(invalidRatingResponse.body.message).toMatch(/whole number from 1 to 5|rating/i);

    const cancelledRide = await Ride.create({
      driver: driver._id,
      source: "Cancelled Review Source",
      destination: "Cancelled Review Destination",
      date: new Date(Date.now() - 432000000),
      seatsAvailable: 2,
      price: 170,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(cancelledRide._id);

    const cancelledBooking = await Booking.create({
      passenger: passenger._id,
      ride: cancelledRide._id,
      seats: 1,
      status: "cancelled",
    });
    createdBookingIds.push(cancelledBooking._id);

    const cancelledBookingResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: cancelledRide._id.toString(),
        bookingId: cancelledBooking._id.toString(),
        rating: 5,
        comment: "No",
      });

    expect(cancelledBookingResponse.status).toBe(400);
    expect(cancelledBookingResponse.body.message).toMatch(/cancelled bookings cannot be reviewed|cancelled/i);
  });

  it("booking ownership, mismatched ride booking, and self-review constraints are enforced", async () => {
    const driver = await User.create({
      name: "Permission Driver",
      email: makeUniqueEmail("permission-driver"),
      password: "secret123",
      roles: ["passenger", "driver"],
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Permission Passenger",
      email: makeUniqueEmail("permission-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ownerRide = await Ride.create({
      driver: driver._id,
      source: "Owner Source",
      destination: "Owner Destination",
      date: new Date(Date.now() - 518400000),
      seatsAvailable: 2,
      price: 140,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(ownerRide._id);

    const anotherPassenger = await User.create({
      name: "Another Passenger",
      email: makeUniqueEmail("another-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(anotherPassenger._id);

    const anotherBooking = await Booking.create({
      passenger: anotherPassenger._id,
      ride: ownerRide._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(anotherBooking._id);

    const otherUserResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: ownerRide._id.toString(),
        bookingId: anotherBooking._id.toString(),
        rating: 5,
        comment: "Not mine",
      });

    expect(otherUserResponse.status).toBe(403);
    expect(otherUserResponse.body.message).toMatch(
      /only review a trip you were part of/i
    );

    const mismatchedRide = await Ride.create({
      driver: driver._id,
      source: "Mismatched Source",
      destination: "Mismatched Destination",
      date: new Date(Date.now() - 604800000),
      seatsAvailable: 2,
      price: 160,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(mismatchedRide._id);

    const mismatchedBooking = await Booking.create({
      passenger: passenger._id,
      ride: ownerRide._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(mismatchedBooking._id);

    const selfReviewBooking = await Booking.create({
      passenger: driver._id,
      ride: ownerRide._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(selfReviewBooking._id);

    const mismatchedResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: mismatchedRide._id.toString(),
        bookingId: mismatchedBooking._id.toString(),
        rating: 5,
        comment: "Wrong ride",
      });

    expect(mismatchedResponse.status).toBe(400);
    expect(mismatchedResponse.body.message).toMatch(/does not belong to this ride/i);

    const selfReviewResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        rideId: ownerRide._id.toString(),
        bookingId: selfReviewBooking._id.toString(),
        rating: 3,
        comment: "Driver review",
      });

    expect(selfReviewResponse.status).toBe(400);
    expect(selfReviewResponse.body.message).toMatch(/cannot review yourself/i);
  });

  it("GET user reviews and ride reviews return the expected records", async () => {
    const driver = await User.create({
      name: "Review Listing Driver",
      email: makeUniqueEmail("review-list-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Review Listing Passenger",
      email: makeUniqueEmail("review-list-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "List Review Source",
      destination: "List Review Destination",
      date: new Date(Date.now() - 691200000),
      seatsAvailable: 2,
      price: 190,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const review = await Review.create({
      reviewer: passenger._id,
      reviewee: driver._id,
      ride: ride._id,
      booking: booking._id,
      rating: 5,
      comment: "Excellent",
    });

    const userReviewsResponse = await request(app).get(`/api/reviews/user/${driver._id}`);
    expect(userReviewsResponse.status).toBe(200);
    expect(userReviewsResponse.body.count).toBeGreaterThanOrEqual(1);
    expect(userReviewsResponse.body.data.some((item) => item._id.toString() === review._id.toString())).toBe(true);

    const rideReviewsResponse = await request(app).get(`/api/reviews/ride/${ride._id}`);
    expect(rideReviewsResponse.status).toBe(200);
    expect(rideReviewsResponse.body.count).toBeGreaterThanOrEqual(1);
    expect(rideReviewsResponse.body.data.some((item) => item._id.toString() === review._id.toString())).toBe(true);
  });
});
