import { Router } from "express";
import {
    getCurrentUser,
    updateName,
    updateCredentials,
    changePassword,
    getAllUsers,
    updateUserRole,
    deleteUser
} from "../controllers/user.controller.js";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { changePasswordSchema, updateCredentialsSchema } from "../validators/auth.validator.js";

const router = Router();

router.use(verifyJWT);

router.get("/me", getCurrentUser);
router.patch("/name", updateName);
router.patch("/credentials", validate(updateCredentialsSchema), updateCredentials);
router.patch("/password", validate(changePasswordSchema), changePassword);

router.get("/", isAdmin, getAllUsers);
router.patch("/:userId/role", isAdmin, updateUserRole);
router.delete("/:userId", isAdmin, deleteUser);

export default router;