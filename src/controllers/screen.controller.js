import { Screen } from "../models/screen.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Create screen (Admin)
export const createScreen = async (req, res, next) => {
    try {
        const { name, location, city, screenType, seatLayout } = req.body;

        if (!name || !location || !city || !seatLayout) {
            throw new apiError(400, "Name, location, city and seatLayout are required");
        }

        if (!Array.isArray(seatLayout) || seatLayout.length === 0) {
            throw new apiError(400, "seatLayout must be a non-empty array");
        }

        const screen = await Screen.create({
            name,
            location,
            city,
            screenType,
            seatLayout
        });

        return res.status(201).json(
            new ApiResponse(201, screen, "Screen created successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Get all screens
export const getAllScreens = async (req, res, next) => {
    try {
        const { city } = req.query;

        const filter = {};
        if (city) filter.city = city.toLowerCase();

        const screens = await Screen.find(filter)
            .sort({ createdAt: -1 });

        return res.status(200).json(
            new ApiResponse(200, screens, "Screens fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};
// Get screen by ID
export const getScreenById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const screen = await Screen.findById(id);

        if (!screen) {
            throw new apiError(404, "Screen not found");
        }

        return res.status(200).json(
            new ApiResponse(200, screen, "Screen fetched successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Update screen (Admin)
export const updateScreen = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (Object.keys(updates).length === 0) {
            throw new apiError(400, "Provide at least one field to update");
        }

        const screen = await Screen.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!screen) {
            throw new apiError(404, "Screen not found");
        }

        return res.status(200).json(
            new ApiResponse(200, screen, "Screen updated successfully")
        );

    } catch (error) {
        next(error);
    }
};

// Delete screen (Admin)
export const deleteScreen = async (req, res, next) => {
    try {
        const { id } = req.params;

        const screen = await Screen.findByIdAndDelete(id);

        if (!screen) {
            throw new apiError(404, "Screen not found");
        }

        return res.status(200).json(
            new ApiResponse(200, {}, "Screen deleted successfully")
        );

    } catch (error) {
        next(error);
    }
};