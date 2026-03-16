import { Hono } from "hono";
import { authRouter } from "./auth";
import { paymentRouter } from "./payment";

export const apiRouter = new Hono();

apiRouter.route("/auth", authRouter);
apiRouter.route("/payment", paymentRouter);
