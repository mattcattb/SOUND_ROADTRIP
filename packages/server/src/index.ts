import {appEnv} from "./common/env";
import {logger} from "./common/logger";
import {addErrorHandling} from "./common/errors";
import {addGlobalMiddlewares, createRouter} from "./common/hono";

import {authController} from "./auth/auth.controller";

import {toursController} from "./tours/tours.controller";

const app = createRouter();
addGlobalMiddlewares(app);
addErrorHandling(app);

app.route("/api/auth", authController);

const api = createRouter().route("/tours", toursController);

app.route("/api", api);

export type AppType = typeof api;

const port = appEnv.PORT;
logger.info(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
