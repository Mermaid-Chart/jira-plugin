// Entry point for the app
// Express is the underlying that atlassian-connect-express uses:
// https://expressjs.com
import express from "express";

// https://expressjs.com/en/guide/using-middleware.html
import bodyParser from "body-parser";
import compression from "compression";
import cookieParser from "cookie-parser";
import errorHandler from "errorhandler";
import morgan from "morgan";

// atlassian-connect-express also provides a middleware
import ace from "atlassian-connect-express";

// Use Handlebars as view engine:
// https://npmjs.org/package/express-hbs
// http://handlebarsjs.com
import hbs from "express-hbs";

// We also need a few stock Node modules
import path from "path";
import os from "os";
import helmet from "helmet";
import nocache from "nocache";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createRequire } from "node:module";
//import logger from "../utils/logger.js";

// Routes live here; this is the C in MVC
import routes from "../routes/index.js";
import { readFileSync } from "fs";

// Use Vercel Serverless Redis connection
import { ServerlessRedisAdapter } from "../serverless-redis.js";

ace.store.register("@upstash/redis", function (logger, opts) {
  if (arguments.length === 0) {
    return ServerlessRedisAdapter;
  }
  return new ServerlessRedisAdapter(logger, opts);
});

console.log("CWD is ", process.cwd());
console.log("NODE_ENV is ", process.env.NODE_ENV);
console.log("VERCEL_ENV is ", process.env.VERCEL_ENV);

// Determine the correct environment based on multiple factors
function determineEnvironment() {
  console.log('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    APP_ENV: process.env.APP_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL
  });

  // First check for explicit APP_ENV override
  if (process.env.APP_ENV) {
    console.log(`Using explicit APP_ENV: ${process.env.APP_ENV}`);
    return process.env.APP_ENV;
  }

  // Check if we can detect stage environment by URL patterns
  const url = process.env.VERCEL_URL || process.env.VERCEL_BRANCH_URL || '';
  if (url.includes('jirastage') || url.includes('stage')) {
    console.log(`Detected stage environment from URL: ${url}`);
    return 'stage';
  }

  // Check if there's an explicit NODE_ENV set and it's not production
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
    console.log(`Using explicit NODE_ENV: ${process.env.NODE_ENV}`);
    return process.env.NODE_ENV;
  }

  // For production NODE_ENV, we need to distinguish between stage and production
  if (process.env.NODE_ENV === 'production') {
    // Check VERCEL_ENV for additional context
    if (process.env.VERCEL_ENV === 'production') {
      // This could be either stage or production
      // Check if there are any indicators for stage
      if (process.env.VERCEL_BRANCH_URL && process.env.VERCEL_BRANCH_URL.includes('stage')) {
        console.log('Detected stage environment from Vercel branch URL');
        return 'stage';
      }
      console.log('Detected production environment');
      return 'production';
    } else if (process.env.VERCEL_ENV === 'preview') {
      console.log('Detected preview environment');
      return 'preview';
    }
  }

  // Check VERCEL_ENV and map appropriately
  if (process.env.VERCEL_ENV) {
    const vercelEnv = process.env.VERCEL_ENV;
    console.log(`VERCEL_ENV detected: ${vercelEnv}`);
    
    const envMapping = {
      'development': 'development',
      'preview': 'preview',
      'production': 'production'
    };
    
    return envMapping[vercelEnv] || vercelEnv;
  }

  // Default fallback
  console.log('No environment detected, defaulting to development');
  return 'development';
}

// Set the environment
const detectedEnv = determineEnvironment();
process.env.NODE_ENV = detectedEnv;
console.log(`Final NODE_ENV set to: ${process.env.NODE_ENV}`);

console.log("config.json is at ", resolve("config.json"));
console.log(
  "config.json is at ",
  createRequire(import.meta.url).resolve("../config.json")
);
console.log(
  "config.json contents are ",
  readFileSync("config.json", { encoding: "utf8" })
);

console.log("atlassian-connect.json is at ", resolve("atlassian-connect.json"));
console.log(
  "atlassian-connect.json is at ",
  createRequire(import.meta.url).resolve("../atlassian-connect.json")
);
console.log(
  "atlassian-connect.json contents are ",
  readFileSync("atlassian-connect.json", { encoding: "utf8" })
);

// Bootstrap Express and atlassian-connect-express
const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

export const addon = ace(app, {
  config: {
    descriptorTransformer(descriptor, config) {
      console.log("Original descriptor baseUrl:", descriptor.baseUrl);
      console.log("Config localBaseUrl:", config.localBaseUrl());
      
      // Ensure the descriptor uses the correct URL based on environment
      const localBaseUrl = config.localBaseUrl();
      descriptor.baseUrl = localBaseUrl;
      
      // Update links to match the environment
      if (descriptor.links) {
        descriptor.links.self = localBaseUrl;
        descriptor.links.artifact = localBaseUrl;
      }
      
      console.log("Transformed descriptor baseUrl:", descriptor.baseUrl);
      console.log("Transformed descriptor:", JSON.stringify(descriptor, null, 2));
      return descriptor;
    },
  },
});

// See config.json
const port = addon.config.port();
app.set("port", port);

console.log("Current environment detected by Express:", app.get("env"));
console.log("NODE_ENV environment variable:", process.env.NODE_ENV);
console.log("Addon config localBaseUrl:", addon.config.localBaseUrl());
console.log("Addon config object:", JSON.stringify(addon.config, null, 2));

// Log requests, using an appropriate formatter by env
export const devEnv = app.get("env") === "development";
app.use(morgan(devEnv ? "dev" : "combined"));

// We don't want to log JWT tokens, for security reasons
morgan.token("url", redactJwtTokens);

// Configure Handlebars
// Testing of what runs in vercel
const viewsDir = path.join(process.cwd(), "views");
const handlebarsEngine = hbs.express4({ partialsDir: viewsDir });
app.engine("hbs", handlebarsEngine);
app.set("view engine", "hbs");
app.set("views", viewsDir);

// Atlassian security policy requirements
// http://go.atlassian.com/security-requirements-for-cloud-apps
// HSTS must be enabled with a minimum age of at least one year
app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: false,
  })
);
app.use(
  helmet.referrerPolicy({
    policy: ["origin"],
  })
);

// Include request parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Gzip responses when appropriate
app.use(compression());

// Include atlassian-connect-express middleware
app.use(addon.middleware());

// Mount the static files directory
const staticDir = path.join(process.cwd(), "public");
app.use(express.static(staticDir));

// Add an hbs helper to fingerprint static resource urls
hbs.registerHelper("furl", function (url) {
  return app.locals.furl(url);
});

// Atlassian security policy requirements
// http://go.atlassian.com/security-requirements-for-cloud-apps
app.use(nocache());

// Show nicer errors in dev mode
if (devEnv) app.use(errorHandler());

// Wire up routes
routes(app, addon);

export default app;

function redactJwtTokens(req) {
  const url = req.originalUrl || req.url || "";
  const params = new URLSearchParams(url);
  let redacted = url;
  params.forEach((value, key) => {
    if (key.toLowerCase() === "jwt") {
      redacted = redacted.replace(value, "redacted");
    }
  });
  return redacted;
}
