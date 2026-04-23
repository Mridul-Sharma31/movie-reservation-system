import rateLimit from "express-rate-limit";

// 1. General API limiter (ALL routes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // in ms
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Strict auth limiter
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many authentication attempts, try again after 15 minutes.",
  },
  skipSuccessfulRequests: true,
});

// 3. Booking limiter
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: "Too many booking attempts, please try again in an hour.",
  },
});
