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
//*By combining name and location, i am telling MongoDB: "I don't care if there are fifty 'Screen 1's. I don't care if there are fifty 'PVR' locations. BUT, there can only ever be exactly ONE 'Screen 1' at PVR Asr
screenSchema.index({ name: 1, location: 1 }, { unique: true });

// Virtual for Total Capacity
// instead of manually updating total capacity everytime we can have this function to do it for us automatically
//* not stored in db but in nodejs memory, if not  used -> data inconsistency If a theater admin adds a new row of VIP seats, backend would have to update the seatLayout array AND remember to update the totalCapacity field. If one operation succeeds and the other fails, database is corrupted
screenSchema.virtual("totalCapacity").get(function() {
    return this.seatLayout.reduce((acc, row) => acc + row.capacity, 0);
});

export const Screen = mongoose.model("Screen", screenSchema);