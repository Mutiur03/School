import Redis from "ioredis";

export const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

export const check = async () => {
  const pong = await redis.ping();
  console.log("Redis PING response:", pong);
};