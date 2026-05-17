import { Router } from "express";
import {
    createScreen,
    getAllScreens,
    getScreenById,
    updateScreen,
    deleteScreen
} from "../controllers/screen.controller.js";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createScreenSchema, updateScreenSchema } from "../validators/screen.validator.js";

const router = Router();

router.get("/", getAllScreens);
router.get("/:id", getScreenById);

router.post("/", verifyJWT, isAdmin, validate(createScreenSchema), createScreen);
router.put("/:id", verifyJWT, isAdmin, validate(updateScreenSchema), updateScreen);
router.delete("/:id", verifyJWT, isAdmin, deleteScreen);

export default router;