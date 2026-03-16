import { Router, type IRouter } from "express";
import healthRouter from "./health";
import summarizeRouter from "./summarize";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(summarizeRouter);
router.use(chatRouter);

export default router;
