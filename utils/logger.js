import { WinstonTransport as AxiomTransport } from "@axiomhq/winston";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "jira-plugin" },
  transports: [
    // You can pass an option here, if you don't the transport is configured automatically
    // using environment variables like `AXIOM_DATASET` and `AXIOM_TOKEN`
    new AxiomTransport({
      dataset: "mc-jira-plugin",
      token: "xaat-96973040-e16f-44b4-b1e9-f2fba86a835b",
      orgId: "tulaco-uwn4",
    }),
  ],
});

export default logger;
