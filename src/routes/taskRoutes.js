import { Router } from "express";
import * as controller from "../controllers/taskController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  createTaskValidation,
  analyticsValidation,
  paginationValidation,
  searchValidation,
  taskIdValidation,
  updateTaskValidation,
} from "../validators/taskValidators.js";

export const taskRouter = Router();
taskRouter.use(requireAuth);

taskRouter.get("/search", [...searchValidation, ...paginationValidation], validate, controller.search);
taskRouter.get("/weekly-summary", controller.weeklySummary);
taskRouter.get("/analytics", analyticsValidation, validate, controller.analytics);
taskRouter
  .route("/")
  .get(paginationValidation, validate, controller.list)
  .post(requireCsrf, createTaskValidation, validate, controller.create);
taskRouter
  .route("/:id")
  .get(taskIdValidation, validate, controller.getOne)
  .put(requireCsrf, [...taskIdValidation, ...updateTaskValidation], validate, controller.update)
  .delete(requireCsrf, taskIdValidation, validate, controller.remove);
