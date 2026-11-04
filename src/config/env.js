const requiredInProduction = ["MONGO_URI", "JWT_SECRET", "COOKIE_SECRET"];

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/altera_todo",
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "development-only-jwt-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  cookieSecret: process.env.COOKIE_SECRET || "development-only-cookie-secret-change-me",
};

export function validateEnvironment() {
  if (env.nodeEnv !== "production") return;
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
