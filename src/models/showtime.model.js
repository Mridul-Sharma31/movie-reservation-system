import mongoose, { Schema } from "mongoose";

const showtimeSchema = new Schema({
    movie: {
        type: Schema.Types.ObjectId,
        ref: "Movie",
        required: true
    },
    screen: {
        type: Schema.Types.ObjectId,
        ref: "Screen",
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ["SCHEDULED", "CANCELLED", "COMPLETED"],
        default: "SCHEDULED"
    },

    // THE HYBRID APPROACH (Sparse + Status)
    // 1. If a seat is NOT in this array -> It is AVAILABLE (Green).
    // 2. If it IS in this array -> check 'status' (Red or Yellow).
    // i don't store all 300-400 seats instead i only store what is booked, this is better 
    // if seat is in this array then it is either booked or locked, i dont need info about all others 
    
    reservedSeats: [
        {
            row: { type: String, required: true },
            seatNumber: { type: Number, required: true },
            status: {
                type: String,
                enum: ["LOCKED", "BOOKED"],
                required: true
            },
            user: { 
                type: Schema.Types.ObjectId, 
                ref: "User",
                required: true
            },
            lockedAt: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

// COMPOUND INDEXES
showtimeSchema.index({ movie: 1, startTime: 1 });
showtimeSchema.index({ screen: 1, startTime: 1, endTime: 1 });

export const Showtime = mongoose.model("Showtime", showtimeSchema);