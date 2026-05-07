import { z } from "zod";

export const createMovieSchema = z.object({
    title: z.string()
        .min(1, "Title is required")
        .max(200, "Title must not exceed 200 characters"),
    
    description: z.string()
        .min(10, "Description must be at least 10 characters")
        .max(1000, "Description must not exceed 1000 characters"),
    
    duration: z.number()
        .int("Duration must be an integer")
        .positive("Duration must be positive")
        .min(1, "Duration must be at least 1 minute")
        .max(500, "Duration seems too long"),
    
    genre: z.array(z.string())
        .min(1, "At least one genre is required")
        .max(5, "Maximum 5 genres allowed"),
    
    language: z.string()
        .min(1, "Language is required"),
    
    releaseDate: z.string()
        .refine(val => !isNaN(Date.parse(val)), "Invalid date format"),
    
    posterImage: z.string()
        .url("Invalid URL format")
        .optional()
});

export const updateMovieSchema = createMovieSchema.partial();