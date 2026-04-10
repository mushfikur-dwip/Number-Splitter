import express, { type Express } from "express";
import cors from "cors";
import * as pinoHttpModule from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http is a CommonJS module; handle both default and named export shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pinoHttp: (opts: any) => any =
  typeof (pinoHttpModule as any).default === "function"
    ? (pinoHttpModule as any).default
    : (pinoHttpModule as any);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: unknown }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
