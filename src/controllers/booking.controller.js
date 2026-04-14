import { Booking } from "../models/booking.model.js";
import { Showtime } from "../models/showtime.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

// Create booking
export const createBooking = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { showtime, seats } = req.body; // seats: [{row: "A", seatNumber: 5}]
        const userId = req.user._id;

        // 1. Validate input
        if (!showtime || !seats || !Array.isArray(seats) || seats.length === 0) {
            throw new apiError(400, "Showtime and seats are required");
        }

        // 2. Get showtime
        const showtimeDoc = await Showtime.findById(showtime)
            .populate("screen", "seatLayout")
            .session(session);

        if (!showtimeDoc) {
            throw new apiError(404, "Showtime not found");
        }

        if (showtimeDoc.status !== "SCHEDULED") {
            throw new apiError(400, "Cannot book for this showtime");
        }

        // 3. Check if seats are available
        for (const seat of seats) {
            const alreadyReserved = showtimeDoc.reservedSeats.find(
                s => s.row === seat.row && s.seatNumber === seat.seatNumber
            );

            if (alreadyReserved) {
                throw new apiError(409, `Seat ${seat.row}${seat.seatNumber} is already reserved`);
            }
        }

        // 4. Calculate total price
        let totalAmount = 0;
        const seatsWithPrice = seats.map(seat => {
            const rowLayout = showtimeDoc.screen.seatLayout.find(
                r => r.rowCode === seat.row
            );

            if (!rowLayout) {
                throw new apiError(400, `Invalid row: ${seat.row}`);
            }

            if (seat.seatNumber < 1 || seat.seatNumber > rowLayout.capacity) {
                throw new apiError(400, `Invalid seat number: ${seat.seatNumber}`);
            }

            totalAmount += rowLayout.price;

            return {
                row: seat.row,
                seatNumber: seat.seatNumber,
                price: rowLayout.price
            };
        });

        // 5. Create booking
        const booking = await Booking.create([{
            showtime,
            user: userId,
            seats: seatsWithPrice,
            totalAmount,
            status: "Confirmed"
        }], { session });

        // 6. Mark seats as BOOKED in showtime
        for (const seat of seats) {
            showtimeDoc.reservedSeats.push({
                row: seat.row,
                seatNumber: seat.seatNumber,
                status: "BOOKED",
                user: userId,
                lockedAt: new Date()
            });
        }

        await showtimeDoc.save({ session });

        // 7. Commit transaction
        await session.commitTransaction();

        return res.status(201).json(
            new ApiResponse(201, booking[0], "Booking created successfully")
        );

    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

// Get user's bookings
export const getUserBookings = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { status } = req.query; // Optional filter: "Confirmed" or "Cancelled"

        const filter = { user: userId };
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .populate("showtime")
            .populate({
                path: "showtime",
                populate: [
                    { path: "movie", select: "title duration genre language" },
                    { path: "screen", select: "name location city" }
                ]
            })
            .sort({ createdAt: -1 });

        return res.status(200).json(
            new ApiResponse(200, bookings, "Bookings fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Get booking by ID
export const getBookingById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const booking = await Booking.findById(id)
            .populate({
                path: "showtime",
                populate: [
                    { path: "movie", select: "title duration genre language" },
                    { path: "screen", select: "name location city" }
                ]
            });

        if (!booking) {
            throw new apiError(404, "Booking not found");
        }

        // User can only see their own bookings (unless admin)
        if (booking.user.toString() !== userId.toString() && req.user.role !== "ADMIN") {
            throw new apiError(403, "Access denied");
        }

        return res.status(200).json(
            new ApiResponse(200, booking, "Booking fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Cancel booking
export const cancelBooking = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user._id;

        // 1. Find booking
        const booking = await Booking.findById(id).session(session);

        if (!booking) {
            throw new apiError(404, "Booking not found");
        }

        // 2. Only owner can cancel
        if (booking.user.toString() !== userId.toString()) {
            throw new apiError(403, "You can only cancel your own bookings");
        }

        // 3. Already cancelled?
        if (booking.status === "Cancelled") {
            throw new apiError(400, "Booking is already cancelled");
        }

        // 4. Get showtime
        const showtime = await Showtime.findById(booking.showtime).session(session);

        if (!showtime) {
            throw new apiError(404, "Showtime not found");
        }

        // 5. Can only cancel upcoming shows
        if (new Date(showtime.startTime) <= new Date()) {
            throw new apiError(400, "Cannot cancel past or ongoing shows");
        }

        // 6. Update booking status
        booking.status = "Cancelled";
        booking.cancelledAt = new Date();
        await booking.save({ session });

        // 7. Release seats from showtime
        for (const seat of booking.seats) {
            showtime.reservedSeats = showtime.reservedSeats.filter(
                s => !(s.row === seat.row && s.seatNumber === seat.seatNumber)
            );
        }

        await showtime.save({ session });

        // 8. Commit
        await session.commitTransaction();

        return res.status(200).json(
            new ApiResponse(200, booking, "Booking cancelled successfully")
        );

    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};
// Get all bookings (Admin)
export const getAllBookings = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(filter)
            .populate("user", "username email fullName")
            .populate({
                path: "showtime",
                populate: [
                    { path: "movie", select: "title" },
                    { path: "screen", select: "name location" }
                ]
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Booking.countDocuments(filter);

        return res.status(200).json(
            new ApiResponse(200, {
                bookings,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalBookings: total
            }, "All bookings fetched")
        );

    } catch (error) {
        next(error);
    }
};