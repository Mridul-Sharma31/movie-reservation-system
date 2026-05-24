import dotenv from "dotenv"
import { app } from "./app.js"
import { connectDB } from "./db/index.js"
import { connectRedis } from "./db/redis.js"


dotenv.config({
    path: './.env'
});

const PORT = process.env.PORT || 8000;

connectDB()
.then(() => {
    connectRedis(); 

    app.listen(PORT, () => {
        console.log(`Server is running at port : ${PORT}`);
    });
})
.catch((error) => {
    console.log("MONGO db connection failed !!! ", error);
});