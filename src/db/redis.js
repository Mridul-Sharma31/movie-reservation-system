import { Redis } from "ioredis";

let redisClient = null;

export const connectRedis = () => {
    if (!process.env.REDIS_URL) {
        console.error(" REDIS_URL is missing in environment variables.");
        process.exit(1);
    }

    try {
        
        redisClient = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3, // Don't retry forever if it fails
        });

        redisClient.on("connect", () => {
            console.log(" Redis Connected Successfully");
        });

        redisClient.on("error", (error) => {
            console.error(" Redis Connection Error:", error.message);
        });

        return redisClient;
    } catch (error) {
        console.error(" Failed to initialize Redis:", error);
        process.exit(1);
    }
};


export const getRedisClient = () => {
    if (!redisClient) {
        throw new Error("Redis client not initialized. Call connectRedis first.");
    }
    return redisClient;
};