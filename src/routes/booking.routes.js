import { Router } from "express";
import {
    lockSeats,
    createBooking,
    getUserBookings,
    getBookingById,
    cancelBooking,
    getAllBookings
} from "../controllers/booking.controller.js";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";
import { bookingLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createBookingSchema } from "../validators/booking.validator.js";

const router = Router();

router.use(verifyJWT);

router.post("/lock", lockSeats);
router.post("/", bookingLimiter, validate(createBookingSchema), createBooking);
router.get("/", getUserBookings);
router.get("/:id", getBookingById);
router.patch("/:id/cancel", cancelBooking);

router.get("/admin/all", isAdmin, getAllBookings);

export default router;