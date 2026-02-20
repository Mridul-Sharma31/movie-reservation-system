export const DB_NAME = "movieReservationDB";

export const USER_ROLES = {
    ADMIN: "ADMIN",
    USER: "USER"
};

export const BOOKING_STATUS = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled"
};

export const SHOWTIME_STATUS = {
    SCHEDULED: "SCHEDULED",
    CANCELLED: "CANCELLED",
    COMPLETED: "COMPLETED"
};

export const SEAT_STATUS = {
    LOCKED: "LOCKED",
    BOOKED: "BOOKED"
};

export const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in ms