import "dotenv/config";

import app from "./app.js";
import { bootstrapQdrant } from "./bootstrap/qdrant-bootstrap.js";
import { connectDatabase } from "./config/database.js";

const port = Number(process.env.PORT || 3001);

async function bootstrap() {
  await connectDatabase();
  await bootstrapQdrant();

  app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend:", error.message);
  process.exit(1);
});
