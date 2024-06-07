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
      token: "xaat-4f79ec61-c2ad-49b7-82bb-4d73b92b4a32",
      orgId: "mc-plugins-luip",
    }),
  ],
});

export default logger;
