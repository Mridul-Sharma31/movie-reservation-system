import mongoose, { Schema } from "mongoose";

const bookingSchema = new Schema({
    showtime: {
        type: Schema.Types.ObjectId,
        ref: "Showtime",
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    seats: [
        {
            row: { type: String, required: true },
            seatNumber: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ["Pending", "Confirmed", "Cancelled"],
        default: "Pending"
    },
    cancelledAt: {
        type: Date,
        default: null
    }
}, { 
    timestamps: true 
});

// "Show me all bookings for this user, newest first"
bookingSchema.index({ user: 1, createdAt: -1 });

// "Show me all bookings for this showtime" (admin: capacity check)
bookingSchema.index({ showtime: 1 });

export const Booking = mongoose.model("Booking", bookingSchema);