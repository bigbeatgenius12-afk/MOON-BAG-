import app from "./app";
import { logger } from "./lib/logger";
import { startBoboBot } from "./bot/bobo";
import { startZubuSocial } from "./bot/zubu-social";
import { startZubuTrader } from "./bot/zubu-trader";
import { startZubuFounder } from "./bot/zubu-coins";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startBoboBot();
  startZubuSocial();
  startZubuTrader();
  startZubuFounder();
});
