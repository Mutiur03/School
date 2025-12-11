import Redis from "ioredis";
const host = process.env.REDIS_HOST || "127.0.0.1";
export const redis = new Redis({
  host: host,
  port: 6379,
});

export const check = async () => {
  const pong = await redis.ping();
  console.log("Redis PING response:", pong);
};
redis.on("error", (err) => console.log("Redis Client Error", err));
