import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors"; 

// Middlewares
import { apiLimiter } from "./middlewares/rateLimiter.middleware.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js"; 

// Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import movieRoutes from "./routes/movie.routes.js";
import showtimeRoutes from "./routes/showtime.routes.js";
import screenRoutes from "./routes/screen.routes.js"; 
import bookingRoutes from "./routes/booking.routes.js"; 

const app = express();

//* middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
}));


app.use(express.json({ limit: "16kb" })); 
app.use(cookieParser());

// Apply general limiter to ALL routes
app.use("/api/", apiLimiter);

//* routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/screens", screenRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/bookings", bookingRoutes);

//! error handler must be at last
app.use(globalErrorHandler);

export { app };