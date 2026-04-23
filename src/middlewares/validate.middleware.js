import { apiError } from "../utils/apiError.js";
import { z } from "zod";

export const validate = (schema) => {
    return (req, res, next) => {
        // safeParse doesn't throw errors, it just returns the result
        const result = schema.safeParse(req.body);
        
        if (!result.success) {
            // Extract the error messages cleanly
            const messages = result.error.issues.map((issue) => issue.message);
            
            // Pass a 400 error to your global error handler
            return next(new apiError(400, "Validation failed", messages));
        }
        
        // If validation passes, move to the controller
        next();
    };
};