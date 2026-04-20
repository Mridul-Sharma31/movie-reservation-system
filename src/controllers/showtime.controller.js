import { Showtime } from "../models/showtime.model.js";
import { Movie } from "../models/movie.model.js";
import { Screen } from "../models/screen.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const BUFFER_MINUTES = 15; // Gap between shows for cleaning

// Create showtime (Admin)
export const createShowtime = async (req, res, next) => {
    try {
        const { movie, screen, startTime } = req.body;

        if (!movie || !screen || !startTime) {
            throw new apiError(400, "Movie, screen and startTime are required");
        }

        // 1. Validate movie
        const movieDoc = await Movie.findById(movie);
        if (!movieDoc) {
            throw new apiError(404, "Movie not found");
        }

        // 2. Validate screen
        const screenDoc = await Screen.findById(screen);
        if (!screenDoc) {
            throw new apiError(404, "Screen not found");
        }

        // 3. Must be in future
        const showStart = new Date(startTime);
        if (showStart <= new Date()) {
            throw new apiError(400, "Showtime must be in the future");
        }

        // 4. Calculate endTime
        const showEnd = new Date(
            showStart.getTime() + (movieDoc.duration + BUFFER_MINUTES) * 60000
        );

        // 5. Check overlap
        const overlap = await Showtime.findOne({
            screen,
            status: "SCHEDULED",
            startTime: { $lt: showEnd },
            endTime: { $gt: showStart }
        });

        if (overlap) {
            throw new apiError(409, "Screen already has a show during this time");
        }

        // 6. Create
        const showtime = await Showtime.create({
            movie,
            screen,
            startTime: showStart,
            endTime: showEnd
        });

        return res.status(201).json(
            new ApiResponse(201, showtime, "Showtime created successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Get all showtimes 
export const getAllShowtimes = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const skip = (page - 1) * limit;

        const showtimes = await Showtime.find({ status: "SCHEDULED" })
            .populate("movie", "title duration genre language")
            .populate("screen", "name location city screenType")
            .sort({ startTime: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Showtime.countDocuments({ status: "SCHEDULED" });

        return res.status(200).json(
            new ApiResponse(200, {
                showtimes,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalShowtimes: total
            }, "Showtimes fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};
// Get showtime by ID
export const getShowtimeById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const showtime = await Showtime.findById(id)
            .populate("movie", "title duration genre language")
            .populate("screen", "name location city screenType seatLayout");

        if (!showtime) {
            throw new apiError(404, "Showtime not found");
        }

        return res.status(200).json(
            new ApiResponse(200, showtime, "Showtime fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Get showtimes by movie
export const getShowtimesByMovie = async (req, res, next) => {
    try {
        const { movieId } = req.params;

        const showtimes = await Showtime.find({
            movie: movieId,
            status: "SCHEDULED",
            startTime: { $gt: new Date() } // Only future shows
        })
            .populate("screen", "name location city screenType")
            .sort({ startTime: 1 });

        return res.status(200).json(
            new ApiResponse(200, showtimes, "Showtimes fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Get showtimes by date
export const getShowtimesByDate = async (req, res, next) => {
    
    try {
        const { date } = req.params; // Format: "2025-01-15"

        // Create start and end of day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const showtimes = await Showtime.find({
            status: "SCHEDULED",
            startTime: { $gte: startOfDay, $lte: endOfDay }
        })
            .populate("movie", "title duration genre language")
            .populate("screen", "name location city screenType")
            .sort({ startTime: 1 });

        return res.status(200).json(
            new ApiResponse(200, showtimes, "Showtimes fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};
// Get available seats for a showtime
export const getAvailableSeats = async (req, res, next) => {
    try {
        const { id } = req.params;
        const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes

        const showtime = await Showtime.findById(id)
            .populate("screen", "seatLayout");

        if (!showtime) {
            throw new apiError(404, "Showtime not found");
        }

        // Generate ALL seats from screen layout
        const allSeats = [];
        showtime.screen.seatLayout.forEach(row => {
            for (let i = 1; i <= row.capacity; i++) {
                allSeats.push({
                    row: row.rowCode,
                    seatNumber: i,
                    type: row.seatType,
                    price: row.price,
                    status: "AVAILABLE"
                });
            }
        });

        // Mark reserved seats
        allSeats.forEach(seat => {
            const reserved = showtime.reservedSeats.find(
                r => r.row === seat.row && r.seatNumber === seat.seatNumber
            );

            if (reserved) {
                if (reserved.status === "BOOKED") {
                    seat.status = "BOOKED";
                } else if (reserved.status === "LOCKED") {
                    // Check if lock expired
                    const elapsed = Date.now() - new Date(reserved.lockedAt).getTime();
                    if (elapsed < LOCK_TIMEOUT) {
                        seat.status = "LOCKED";
                    }
                    // If expired → stays "AVAILABLE"
                }
            }
        });

        return res.status(200).json(
            new ApiResponse(200, {
                showtime: {
                    _id: showtime._id,
                    movie: showtime.movie,
                    startTime: showtime.startTime
                },
                seats: allSeats
            }, "Seats fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Cancel showtime (Admin)
export const cancelShowtime = async (req, res, next) => {
    try {
        const { id } = req.params;

        const showtime = await Showtime.findById(id);

        if (!showtime) {
            throw new apiError(404, "Showtime not found");
        }

        if (showtime.status === "CANCELLED") {
            throw new apiError(400, "Showtime is already cancelled");
        }

        showtime.status = "CANCELLED";
        await showtime.save();

        return res.status(200).json(
            new ApiResponse(200, showtime, "Showtime cancelled successfully")
        );

    } catch (error) {
        next(error);
    }
};