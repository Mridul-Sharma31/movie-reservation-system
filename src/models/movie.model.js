import mongoose,{Schema} from "mongoose";

const movieSchema = new Schema(
    {
        title:{
            type:String,
            required:true,
            unique:true,
            trim:true
        },
        description: {
            type: String,
            required: true,
            trim: true 
        },
        duration: { //! duration is in minutes do not get confused
            type: Number,
            required: true
        },
        genre: [{ 
            type: String,  //* array of strings since a movie will have multiple genres 
            required: true,
            trim: true 
        }],
        language: {
            type: String,
            required: true,
            trim: true 
        },
        releaseDate: { //* added it since i dont want the unreleased movie to be booked beforehand , this is my business logic for now
            type: Date,
            required: true
        },
        posterImage: {
            type: String, 
            required: true,
            trim: true 
        }
}, { timestamps: true }
)

export const Movie = mongoose.model("Movie",movieSchema);