import rateLimit from "express-rate-limit";

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "AI_RATE_LIMIT",
    message:  "Too many AI requests. Please try again later.",
  },
});