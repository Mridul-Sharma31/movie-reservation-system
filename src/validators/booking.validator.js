import { z } from "zod";

const seatSchema = z.object({
    row: z.string()
        .length(1, "Row must be a single character")
        .regex(/^[A-Z]$/, "Row must be an uppercase letter"),
    
    seatNumber: z.number()
        .int()
        .positive()
        .min(1, "Seat number must be at least 1")
});

export const createBookingSchema = z.object({
    showtime: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid showtime ID format"),
    
    seats: z.array(seatSchema)
        .min(1, "At least one seat is required")
        .max(10, "Cannot book more than 10 seats at once")
});