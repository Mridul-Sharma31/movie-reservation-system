import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Get current user profile
export const getCurrentUser = async (req, res, next) => {
    try {
        return res.status(200).json(
            new ApiResponse(200, req.user, "User fetched successfully")
        );
    } catch (error) {
        next(error);
    }
};

// Update profile (name, email)
// Simple update - no security risk
export const updateName = async (req, res, next) => {
    try {
        const { fullName } = req.body;

        if (!fullName?.trim()) {
            throw new apiError(400, "Name is required");
        }

        if (fullName.trim() === req.user.fullName) {
            throw new apiError(400, "New name must be different");
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { fullName: fullName.trim() } },
            { new: true }
        ).select("-password -refreshToken");

        return res.status(200).json(
            new ApiResponse(200, updatedUser, "Name updated")
        );

    } catch (error) {
        next(error);
    }
};

// Sensitive update - password required!
export const updateCredentials = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!password?.trim()) {
            throw new apiError(400, "Password required to change credentials");
        }

        if (!username && !email) {
            throw new apiError(400, "Provide username or email to update");
        }

        const user = await User.findById(req.user._id);
        const isValid = await user.verifyPassword(password);

        if (!isValid) {
            throw new apiError(401, "Incorrect password");
        }

        // Check if values are actually different
        if (username?.trim() && username.trim().toLowerCase() === user.username) {
            throw new apiError(400, "New username must be different");
        }

        if (email?.trim() && email.trim().toLowerCase() === user.email) {
            throw new apiError(400, "New email must be different");
        }

        if (username?.trim()) user.username = username.trim().toLowerCase();
        if (email?.trim()) user.email = email.trim().toLowerCase();

        user.refreshToken = undefined;
        await user.save();

        const options = { httpOnly: true, secure: true };

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
                new ApiResponse(200, {}, "Credentials updated. Please login again")
            );

    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            throw new apiError(400, "Both old and new password are required");
        }

        if (oldPassword === newPassword) {
            throw new apiError(400, "New password must be different");
        }

        // Need password field (not in req.user because we used .select("-password"))
        const user = await User.findById(req.user._id);

        const isPasswordValid = await user.verifyPassword(oldPassword);
        if (!isPasswordValid) {
            throw new apiError(401, "Current password is incorrect");
        }

        user.password = newPassword;

        // Clear refresh token → force re-login
        user.refreshToken = undefined;
        await user.save(); // pre-save hook will hash the password

        const options = { httpOnly: true, secure: true };

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
                new ApiResponse(200, {}, "Password changed. Please login again")
            );

    } catch (error) {
        next(error);
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find()
            .select("-password -refreshToken")
            .sort({ createdAt: -1 });

        return res.status(200).json(
            new ApiResponse(200, users, "All users fetched")
        );

    } catch (error) {
        next(error);
    }
};

export const updateUserRole = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !["ADMIN", "USER"].includes(role)) {
            throw new apiError(400, "Valid role is required (ADMIN or USER)");
        }

        // Prevent self role change
        if (userId === req.user._id.toString()) {
            throw new apiError(400, "Cannot change your own role");
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new apiError(404, "User not found");
        }

        if (user.role === role) {
            throw new apiError(400, `User is already ${role}`);
        }

        user.role = role;
        await user.save({ validateBeforeSave: false });

        const updatedUser = await User.findById(userId)
            .select("-password -refreshToken");

        return res.status(200).json(
            new ApiResponse(200, updatedUser, `User role updated to ${role}`)
        );

    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Prevent self deletion
        if (userId === req.user._id.toString()) {
            throw new apiError(400, "Cannot delete yourself");
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new apiError(404, "User not found");
        }

        // Prevent deleting another admin (safer)
        if (user.role === "ADMIN") {
            throw new apiError(403, "Cannot delete another admin");
        }

        await User.findByIdAndDelete(userId);

        return res.status(200).json(
            new ApiResponse(200, {}, "User deleted successfully")
        );

    } catch (error) {
        next(error);
    }
};