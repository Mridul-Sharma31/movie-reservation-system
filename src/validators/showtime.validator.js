import { z } from "zod";

export const createShowtimeSchema = z.object({
    movie: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid movie ID format"),
    
    screen: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid screen ID format"),
    
    startTime: z.string()
        .refine(val => !isNaN(Date.parse(val)), "Invalid date format")
        .refine(val => new Date(val) > new Date(), "Start time must be in the future")
});