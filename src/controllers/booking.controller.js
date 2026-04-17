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
        const { showtime, seats } = req.body;
        const userId = req.user._id;

        // 1. Validate showtime exists and get screen layout for pricing
        const showtimeDoc = await Showtime.findById(showtime)
            .populate("screen", "seatLayout")
            .session(session);

        if (!showtimeDoc) {
            throw new apiError(404, "Showtime not found");
        }

        if (showtimeDoc.status !== "SCHEDULED") {
            throw new apiError(400, "Cannot book for this showtime");
        }

        // 2. Calculate price (still use Node.js memory for READ-ONLY operations)
        let totalAmount = 0;
        const seatsWithPrice = seats.map(seat => {
            const rowLayout = showtimeDoc.screen.seatLayout.find(
                r => r.rowCode === seat.row
            );

            if (!rowLayout) {
                throw new apiError(400, `Invalid row: ${seat.row}`);
            }

            if (seat.seatNumber < 1 || seat.seatNumber > rowLayout.capacity) {
                throw new apiError(400, `Invalid seat: ${seat.row}${seat.seatNumber}`);
            }

            totalAmount += rowLayout.price;

            return {
                row: seat.row,
                seatNumber: seat.seatNumber,
                price: rowLayout.price
            };
        });

        // 3. ATOMIC UPDATE (The Critical Fix!)
        // Tell MongoDB: "Update ONLY if these seats are NOT already reserved"
        // The check AND write happen in ONE atomic operation at DB level
        const updatedShowtime = await Showtime.findOneAndUpdate(
            {
                _id: showtime,
                status: "SCHEDULED",
                // ✅ THE MAGIC LINE:
                // Only update if NONE of the requested seats exist in reservedSeats
                reservedSeats: {
                    $not: {
                        $elemMatch: {
                            row: { $in: seats.map(s => s.row) },
                            seatNumber: { $in: seats.map(s => s.seatNumber) }
                        }
                    }
                }
            },
            {
                // Push ALL seats at once if condition is met
                $push: {
                    reservedSeats: {
                        $each: seats.map(seat => ({
                            row: seat.row,
                            seatNumber: seat.seatNumber,
                            status: "BOOKED",
                            user: userId,
                            lockedAt: new Date()
                        }))
                    }
                }
            },
            { new: true, session }
        );

        // 4. If null → seats were taken between user clicking and DB writing
        if (!updatedShowtime) {
            throw new apiError(
                409,
                "One or more selected seats were just taken. Please select different seats."
            );
        }

        // 5. Create booking record
        const booking = await Booking.create([{
            showtime,
            user: userId,
            seats: seatsWithPrice,
            totalAmount,
            status: "Confirmed"
        }], { session });

        // 6. Commit both operations
        await session.commitTransaction();

        return res.status(201).json(
            new ApiResponse(201, booking[0], "Booking confirmed successfully")
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
        const { status, page = 1, limit = 10 } = req.query;

        const filter = { user: userId };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(filter)
            .populate({
                path: "showtime",
                populate: [
                    { path: "movie", select: "title duration genre language" },
                    { path: "screen", select: "name location city" }
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
            }, "Bookings fetched successfully")
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
        //* extract the details from the frontend , if they dont provide it we are setting default values
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