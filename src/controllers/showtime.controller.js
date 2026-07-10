import { Showtime } from "../models/showtime.model.js";
import { Movie } from "../models/movie.model.js";
import { Screen } from "../models/screen.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { getRedisClient } from "../db/redis.js";

const BUFFER_MINUTES = 15; // Gap between shows for cleaning

//* why populate? because if i dont then frontend has to extract screen id and movie id from the document and then make additional api calls
//* by populating in the server i handover the complete data to the frontend , it kills latency and is more efficient for my app
//* it is also better for frontend this way to render data of movie and screen if they need to

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
        // offset pagination
        const { page = 1, limit = 20 } = req.query;
        

        //* what pages i have seen before * number of data items they had = skip them 
        const skip = (page - 1) * limit;

        const showtimes = await Showtime.find({ status: "SCHEDULED" })
        //* populate -> just like join of SQL. for eg in showtime we just take object id of movie and screen but what if we want the actual objects and their feilds? we then use populate
            .populate("movie", "title duration genre language")
            .populate("screen", "name location city screenType")
            .sort({ startTime: 1 }) //* sorts from earliest to latest
            .skip(skip) //* skip this much documents from the db
            .limit(parseInt(limit)); //* the number of docs should not exceed this limit , parseint for robustness (never trust frontend)

        //* count the number of documents with matching criteria  
        //* why query two times? because in first i am finding the scheduled showtimes only
        //* now i need to tell the frontend how many showtimes are there in total so he can display to the user page x of y. the y is this query's result.
        //* countdocuments do not load the documents into the server memory they just perform a lightweight lookup and return an int.
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

        //* no status:scheduled here cuz what if admin wants a movie which was cancelled? 
        //* in previous controller it was expected for displaying the movies to the users hence scheduled was necessary
        // but in this it is expected that we want the movie exactly by id regardless of its status.
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
    //* what are all the showtimes playing on this date?
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
        //* renaming the id to showtime id so it doesnt conflict later with other id's
        const { id: showtimeId } = req.params;

        // call the redis client 
        const redis = getRedisClient();

        //* need the showtime with seat layout and screens , but i only care about seatLayout hence passed as 2nd string
        const showtime = await Showtime.findById(showtimeId)
            .populate("screen", "seatLayout");

        if (!showtime) {
            throw new apiError(404, "Showtime not found");
        }

        // 1. Generate ALL seats and build Redis keys
        const allSeats = [];
        const redisKeys = []; // We will batch-query all these keys at once

        //* outer loop ->rows, innner loop-> columns or capacity(seats)
        showtime.screen.seatLayout.forEach(row => {
            for (let i = 1; i <= row.capacity; i++) {
                allSeats.push({
                    row: row.rowCode,
                    seatNumber: i,
                    type: row.seatType,
                    price: row.price,
                    status: "AVAILABLE" // Default assumption
                });
                // Add the exact Redis key format we used in the lock controller
                redisKeys.push(`lock:show:${showtimeId}:seat:${row.rowCode}:${i}`);
            }
        });

        // 2. Fetch ALL locks from Redis in ONE blazing-fast network call
        //* mget - multiget, instead of calling redis for each entry i hand over the entire array 
        //* if a lock exists for that index the value will be userid otherwise it will be null
        const redisLocks = redisKeys.length > 0 ? await redis.mget(redisKeys) : [];

        // 3. Sync states (MongoDB permanent vs Redis temporary)
        allSeats.forEach((seat, index) => {
            // Check permanent booking in MongoDB
            const isBookedInMongo = showtime.reservedSeats.find(
                r => r.row === seat.row && r.seatNumber === seat.seatNumber && r.status === "BOOKED"
            );

            if (isBookedInMongo) {
                seat.status = "BOOKED";
                return; // Stop checking this seat, move to the next one
            }

            // Check temporary lock in Redis
            // redisLocks array perfectly aligns with our allSeats array
            const lockOwner = redisLocks[index];
            if (lockOwner) {
                seat.status = "LOCKED";
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
            }, "Seat map synced and fetched successfully")
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