import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env, validateEnvironment } from "./config/env.js";

async function start() {
  validateEnvironment();
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error("Unable to start API", error.message);
  process.exit(1);
});
