import { Router } from "express";
import {
    createShowtime,
    getAllShowtimes,
    getShowtimeById,
    getShowtimesByMovie,
    getShowtimesByDate,
    getAvailableSeats,
    cancelShowtime
} from "../controllers/showtime.controller.js";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createShowtimeSchema } from "../validators/showtime.validator.js";

const router = Router();

router.get("/", getAllShowtimes);
router.get("/:id", getShowtimeById);
router.get("/:id/seats", getAvailableSeats);
router.get("/movie/:movieId", getShowtimesByMovie);
router.get("/date/:date", getShowtimesByDate);

router.post("/", verifyJWT, isAdmin, validate(createShowtimeSchema), createShowtime);
router.patch("/:id/cancel", verifyJWT, isAdmin, cancelShowtime);

export default router;