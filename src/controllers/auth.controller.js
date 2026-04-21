import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

//* helper function to generate tokens
export const generateTokens = async (user) => {
    try {
        
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        // save refresh token in the db
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});
        return { accessToken, refreshToken };

    } catch (error) {
        
        throw new Error("something went wrong while generating tokens");

        throw new apiError(500,"something went wrong while generating tokens");
    }
}

//* 1) register controller
export const registerUser = async (req ,res, next) =>{
    try {
        
        const {username,email,fullName,password} = req.body;
        
        if ([username, email, fullName, password].some((field) => !field?.trim())) {
            throw new apiError(400, "All fields are required");
        }

        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) {
            throw new apiError(409, "User already exists");
        }

        console.log("Attempting to create user with:", req.body);
        console.log("Attempting to create user with:", { username, email, fullName });

        const user = await User.create({
            fullName,
            email,
            password,
            username: username.toLowerCase()
        });
        
        const { accessToken, refreshToken } = await generateTokens(user);
        
        const createdUser = await User.findById(user._id).select("-password -refreshToken");

        if (!createdUser) {
            throw new apiError(500, "Something went wrong while registering the user");
        }

        
        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(201)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(201, {
                    user: createdUser,
                    accessToken
                }, "User registered successfully")
            );

    } catch (error) {
        next(error);
    }
}

//* login
export const loginUser = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;

        if (!username && !email) {
            throw new apiError(400, "Username or email is required");
        }

        const user = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (!user) {
            throw new apiError(404, "User does not exist");
        }

        const isPasswordValid = await user.verifyPassword(password);

        if (!isPasswordValid) {
            throw new apiError(401, "Invalid user credentials");
        }

        const { accessToken, refreshToken } = await generateTokens(user);

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

        const options = {
            httpOnly: true,
            secure: true // true for https only
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    { user: loggedInUser, accessToken }, 
                    "User logged in Successfully"
                )
            );

    } catch (error) {
        next(error);
    }
};

//* --- LOGOUT ---
export const logoutUser = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: { refreshToken: undefined } // Remove token from DB
            },
            { new: true }
        );

        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User logged out"));

    } catch (error) {
        next(error);
    }
};

//* --- REFRESH TOKEN  ---
export const refreshAccessToken = async (req, res, next) => {
    try {
        // Get refresh token from cookie OR body
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!incomingRefreshToken) {
            throw new apiError(401, "Unauthorized request");
        }

        // Verify it
        let decodedToken;
        try {
            decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (error) {
            throw new apiError(401, "Refresh token is expired or invalid");
        }

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new apiError(401, "Invalid refresh token");
        }

        // Security Check: Does the token match what we have in DB?
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token is used or expired");
        }

        // Generate NEW tokens (Rotate them)
        const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);

        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    { accessToken}, 
                    "Access token refreshed"
                )
            );

    } catch (error) {
        next(error);
    }
};