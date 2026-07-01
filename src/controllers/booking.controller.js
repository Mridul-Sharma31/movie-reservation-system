import { Booking } from "../models/booking.model.js";
import { Showtime } from "../models/showtime.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getRedisClient } from "../db/redis.js";
import mongoose from "mongoose";


// Temporarily lock seats (Step 1 of Booking)
export const lockSeats = async (req, res, next) => {
    try {
        const { showtime, seats } = req.body;
        const userId = req.user._id;
        const redis = getRedisClient();

        // 1. Check if ANY of the requested seats are already locked
        //* seats are an array of objects , check screen schema

        for (const seat of seats) {
            const key = `lock:show:${showtime}:seat:${seat.row}:${seat.seatNumber}`;
            const lockOwner = await redis.get(key); //* does any owner exist with the same key?
            
            if (lockOwner && lockOwner !== userId.toString()) {
                throw new apiError(409, `Seat ${seat.row}${seat.seatNumber} is currently locked by another user. Please choose another.`);
            }
        }

        // 2. If all are free, lock them for 10 minutes (600 seconds)
        const pipeline = redis.pipeline(); // Pipeline executes commands in a single batch
        for (const seat of seats) {
            const key = `lock:show:${showtime}:seat:${seat.row}:${seat.seatNumber}`;
            pipeline.setex(key, 600, userId.toString()); //* setex == set + expire
        }
        await pipeline.exec(); //* execute the pipeline

        return res.status(200).json(
            new ApiResponse(200, { 
                showtime, 
                seats, 
                lockedUntil: new Date(Date.now() + 600 * 1000) // 10 mins from now
            }, "Seats temporarily locked for 10 minutes. Proceed to payment.")
        );

    } catch (error) {
        next(error);
    }
};

// Create booking
export const createBooking = async (req, res, next) => {
    //* create mongo db transaction - either EVERYTHING succeeds OR NOTHING changes
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { showtime, seats } = req.body;
        const userId = req.user._id;
        const redis = getRedisClient(); // Initialize Redis Client

        // ==========================================
        // STEP 1: REDIS LOCK VALIDATION
        // ==========================================
        // Before we do ANY heavy database work, we verify the user actually holds the 10-minute lock.
        for (const seat of seats) {
            const key = `lock:show:${showtime}:seat:${seat.row}:${seat.seatNumber}`;
            const lockOwner = await redis.get(key);
            
            if (lockOwner !== userId.toString()) {
                throw new apiError(400, `Your lock on seat ${seat.row}${seat.seatNumber} has expired or was not acquired. Please lock the seats first.`);
            }
        }

        // ==========================================
        // STEP 2: MONGO DB VALIDATION & PRICING
        // ==========================================
        const showtimeDoc = await Showtime.findById(showtime)
            .populate("screen", "seatLayout")
            .session(session); //* this operation belongs to transaction context.

        if (!showtimeDoc) throw new apiError(404, "Showtime not found");
        if (showtimeDoc.status !== "SCHEDULED") throw new apiError(400, "Cannot book for this showtime");
        
        /* //* validate seats
           //* calculate price
           //* create final booking seat structure
            */
        let totalAmount = 0;
        const seatsWithPrice = seats.map(seat => {
            const rowLayout = showtimeDoc.screen.seatLayout.find(r => r.rowCode === seat.row);
            
            if (!rowLayout) throw new apiError(400, `Invalid row: ${seat.row}`);
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

        // ==========================================
        // STEP 3: ATOMIC MONGO DB UPDATE (Secondary Safety)
        // ==========================================
        /* //* When User A's delayed request finally hits the database, MongoDB uses Document-Level Locking. It freezes the Showtime document for a microsecond.
            It asks: "Are the seats User A wants already inside the reservedSeats array?"
            If no -> It pushes them in and saves. */
        // it is important in many cases for eg one of the case can be user a has hit lock but it stays on the payment page and 10 min lock expires,
        // now user b can lock the seat and simultaneously on the other hand user a can complete the payment and book the seat, this proves
        // redis cannot act as a final source of truth we must ensure atomic mongodb layer 
        // this mongo db layer freezes the document for nanoseconds hence no concurrency can occur here and one has to exit the process without any bookings


        //*findOneAndUpdate takes three distinct arguments:

//* The Filter: Which document are we modifying?

//* The Update: What exact physical change are we making?

//* The Options: How should MongoDB execute this command?
        const updatedShowtime = await Showtime.findOneAndUpdate(
            {
                _id: showtime,
                status: "SCHEDULED",
                reservedSeats: {
                    $not: { //*If $elemMatch finds a collision, it evaluates to TRUE. The $not flips it to FALSE, causing the entire filter to fail and blocking the write.
                        $elemMatch: { //*This is an array iteration operator. It tells MongoDB to loop through the reservedSeats array and check if any single object inside it matches the conditions you provide.
                            $or: seats.map(seat => ({ 
                            row: seat.row, 
                            seatNumber: seat.seatNumber 
                            }))
                        }
                    }
                }
            },
            {
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

        if (!updatedShowtime) {
            throw new apiError(409, "One or more selected seats were just taken.");
        }

        // ==========================================
        // STEP 4: CREATE PERMANENT BOOKING
        // ==========================================
        const booking = await Booking.create([{
            showtime,
            user: userId,
            seats: seatsWithPrice,
            totalAmount,
            status: "Confirmed"
        }], { session });

        // ==========================================
        // STEP 5: REDIS CLEANUP
        // ==========================================
        // The booking is permanently in MongoDB. We delete the temporary Redis locks.
        const pipeline = redis.pipeline();
        for (const seat of seats) {
            const key = `lock:show:${showtime}:seat:${seat.row}:${seat.seatNumber}`;
            pipeline.del(key);
        }
        await pipeline.exec();

        // 6. Commit everything
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