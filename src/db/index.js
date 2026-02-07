import mongoose from "mongoose";

export const connectDB = async () => {

    const MONGODB_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.DB_NAME;

    try {
        
        const connectionInstance = await mongoose.connect(
            `${MONGODB_URI}/${DB_NAME}`
        )

        console.log("MongoDB Connected Successfully",
                    connectionInstance.connection.host);

    } catch (error) {
        console.log("mongo db connection error",error)
        process.exit(1);
    }

}