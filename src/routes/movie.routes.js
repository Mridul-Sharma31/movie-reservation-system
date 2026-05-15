import { Router } from "express";
import {
    createMovie,
    getAllMovies,
    getMovieById,
    updateMovie,
    deleteMovie
} from "../controllers/movie.controller.js";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createMovieSchema, updateMovieSchema } from "../validators/movie.validator.js";

const router = Router();

router.get("/", getAllMovies);
router.get("/:id", getMovieById);

router.post("/", verifyJWT, isAdmin, validate(createMovieSchema), createMovie);
router.put("/:id", verifyJWT, isAdmin, validate(updateMovieSchema), updateMovie);
router.delete("/:id", verifyJWT, isAdmin, deleteMovie);

export default router;