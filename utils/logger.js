import { WinstonTransport as AxiomTransport } from "@axiomhq/winston";
import winston, { loggers } from "winston";

const winstonLogger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "jira-plugin" },
  transports: [
    // You can pass an option here, if you don't the transport is configured automatically
    // using environment variables like `AXIOM_DATASET` and `AXIOM_TOKEN`
    new AxiomTransport({
      dataset: "mc-jira-plugin",
      token: process.env.MC_AXIOM_TOKEN,
      orgId: process.env.MC_AXIOM_ORG_ID,
    }),
  ],
});
console.log("The Token is:", process.env.MC_AXIOM_TOKEN);
console.log("The Org ID is:", process.env.MC_AXIOM_ORG_ID);
class Logger {
  info(message) {
    winstonLogger.info(message);
    console.log(message);
  }

  info(message, ...meta) {
    winstonLogger.info(message, meta);
    console.log(message, meta);
  }

  error(message) {
    winstonLogger.error(message);
    console.error(message);
  }

  error(message, ...meta) {
    winstonLogger.error(message, meta);
    console.error(message, meta);
  }
}

export default new Logger();
