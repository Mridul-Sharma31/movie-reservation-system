import jwt, { decode } from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";

const verifyJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new apiError(401, "Unauthorized request: No token provided");
    }

    let decodedToken;

    try {
      decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new apiError(401, "access token expired");
      }
      throw new apiError(401, "Invalid token");
    }

    // now i have the decoded token, as i have it stored in the db also i can use it to find the user and attach it to the req
    const user = await User.findById(decodedToken._id).select(
      "-password -refreshToken",
    );

    if (!user) {
      throw new apiError(404, "user not found:invalid access token");
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

// Check if user is admin
export const isAdmin = (req, res, next) => {
    try {
        if (req.user?.role !== "ADMIN") {
            throw new apiError(403, "Access denied. Admins only");
        }
        next();
    } catch (error) {
        next(error);
    }
};

export { verifyJWT };
