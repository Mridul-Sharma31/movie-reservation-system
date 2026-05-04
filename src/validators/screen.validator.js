import { z } from "zod";

const rowSchema = z.object({
    rowCode: z.string()
        .length(1, "Row code must be a single character")
        .regex(/^[A-Z]$/, "Row code must be an uppercase letter"),
    
    capacity: z.number()
        .int()
        .positive()
        .min(1, "Capacity must be at least 1")
        .max(50, "Capacity cannot exceed 50 seats per row"),
    
    seatType: z.enum(["STANDARD", "VIP", "PREMIUM"]),
    
    price: z.number()
        .positive("Price must be positive")
        .min(1, "Price must be at least 1")
});

export const createScreenSchema = z.object({
    name: z.string()
        .min(1, "Screen name is required")
        .max(50, "Name must not exceed 50 characters"),
    
    location: z.string()
        .min(1, "Location is required")
        .max(200, "Location must not exceed 200 characters"),
    
    city: z.string()
        .min(1, "City is required")
        .max(50, "City must not exceed 50 characters"),
    
    screenType: z.enum(["Standard", "IMAX", "VIP"])
        .optional(),
    
    seatLayout: z.array(rowSchema)
        .min(1, "At least one row is required")
        .max(26, "Maximum 26 rows allowed (A-Z)")
});

export const updateScreenSchema = createScreenSchema.partial();