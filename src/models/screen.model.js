import mongoose,{Schema} from "mongoose";

// Sub-schema for Rows (Cleaner structure, modular and more readable)
// in short, i do not identify "seats" in my schema, but i identify rows
// instead of 300 entries for seats i have only 30 rows with capacity 10 each -> smart choice

const rowSchema = new Schema({
    rowCode: { 
        type: String, 
        required: true, 
        uppercase: true, 
        trim: true 
    }, // e.g., "A"
    capacity: { 
        type: Number, 
        required: true 
    }, // e.g., 10 seats
    seatType: { 
        type: String, 
        enum: ["STANDARD", "VIP", "PREMIUM"], 
        default: "STANDARD" 
    }, // Row-level typing
    price: { 
        type: Number, 
        required: true 
    }
});

const screenSchema = new Schema({
    name: {
        type: String, // screen 1 , screen 2 etc
        required: true,
        trim: true
    },
    location: {
        type: String, // pvr, inox etc
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    screenType: {
        type: String,
        enum: ["Standard", "IMAX", "VIP"],
        default: "Standard"
    },
    seatLayout: [rowSchema] // Using the sub-schema
}, { 
    timestamps: true,
    toJSON: { virtuals: true }, //  Enable virtuals in JSON
    toObject: { virtuals: true }
});

//  Compound Unique Index
// "Screen 1" can exist in "Delhi" and "Mumbai", but not twice in "Delhi"
screenSchema.index({ name: 1, location: 1 }, { unique: true });

// Virtual for Total Capacity
// instead of manually updating total capacity everytime we can have this function to do it for us automatically

screenSchema.virtual("totalCapacity").get(function() {
    return this.seatLayout.reduce((acc, row) => acc + row.capacity, 0);
});

export const Screen = mongoose.model("Screen", screenSchema);