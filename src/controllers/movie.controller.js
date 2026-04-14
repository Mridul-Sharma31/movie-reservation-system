import { Movie } from "../models/movie.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Create movie (Admin only)
export const createMovie = async (req, res, next) => {
    try {
        const { title, description, duration, genre, language, releaseDate } = req.body;

        if (!title || !description || !duration || !genre || !language || !releaseDate) {
            throw new apiError(400, "All fields are required");
        }

        const existingMovie = await Movie.findOne({ title });
        if (existingMovie) {
            throw new apiError(409, "Movie with this title already exists");
        }

        const movie = await Movie.create({
            title,
            description,
            duration,
            genre,
            language,
            releaseDate
        });

        return res.status(201).json(
            new ApiResponse(201, movie, "Movie created successfully")
        );

    } catch (error) {
        next(error);
    }
};

export const getAllMovies = async (req, res, next) => {
    try {
        const { genre, language, search, page = 1, limit = 10 } = req.query;

        const filter = {};

        if (genre) filter.genre = genre;
        if (language) filter.language = language;
        if (search) {
            filter.title = { $regex: search, $options: "i" };
        }

        const skip = (page - 1) * limit;

        const movies = await Movie.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Movie.countDocuments(filter);

        return res.status(200).json(
            new ApiResponse(200, {
                movies,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalMovies: total
            }, "Movies fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

export const getMovieById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const movie = await Movie.findById(id);

        if (!movie) {
            throw new apiError(404, "Movie not found");
        }

        return res.status(200).json(
            new ApiResponse(200, movie, "Movie fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

export const updateMovie = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (Object.keys(updates).length === 0) {
            throw new apiError(400, "Provide at least one field to update");
        }

        const movie = await Movie.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!movie) {
            throw new apiError(404, "Movie not found");
        }

        return res.status(200).json(
            new ApiResponse(200, movie, "Movie updated successfully")
        );

    } catch (error) {
        next(error);
    }
};

export const deleteMovie = async (req, res, next) => {
    try {
        const { id } = req.params;

        const movie = await Movie.findByIdAndDelete(id);

        if (!movie) {
            throw new apiError(404, "Movie not found");
        }

        return res.status(200).json(
            new ApiResponse(200, {}, "Movie deleted successfully")
        );

    } catch (error) {
        next(error);
    }
};