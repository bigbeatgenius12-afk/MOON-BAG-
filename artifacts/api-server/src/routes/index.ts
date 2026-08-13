import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import launchedCoinsRouter from "./launched-coins";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(launchedCoinsRouter);
router.use(storageRouter);

export default router;
