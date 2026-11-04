import { body, param, query } from "express-validator";

const title = body("title")
  .trim()
  .notEmpty()
  .withMessage("Title is required")
  .isLength({ max: 160 })
  .withMessage("Title is too long");
const description = body("description")
  .optional()
  .trim()
  .isLength({ max: 2000 })
  .withMessage("Description is too long");
const scheduledAt = body("scheduledAt").isISO8601().withMessage("A valid date and time are required").toDate();
const priority = body("priority")
  .optional()
  .isIn(["Low", "Medium", "High"])
  .withMessage("Priority must be Low, Medium, or High");
const status = body("status")
  .optional()
  .isIn(["Pending", "In Progress", "Completed"])
  .withMessage("Status must be Pending, In Progress, or Completed");

export const createTaskValidation = [title, description, scheduledAt, priority, status];
export const updateTaskValidation = [
  body()
    .custom((value) =>
      Object.keys(value).some((key) => ["title", "description", "scheduledAt", "priority", "status"].includes(key)),
    )
    .withMessage("Provide at least one task field"),
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty")
    .isLength({ max: 160 })
    .withMessage("Title is too long"),
  description,
  body("scheduledAt").optional().isISO8601().withMessage("Date and time must be valid").toDate(),
  priority,
  status,
];
export const taskIdValidation = [param("id").isMongoId().withMessage("Invalid task ID")];
export const searchValidation = [
  query("q").trim().isLength({ min: 1, max: 120 }).withMessage("Search query is required"),
];
export const paginationValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("status").optional().isIn(["Pending", "In Progress", "Completed"]).withMessage("Invalid status"),
  query("priority").optional().isIn(["Low", "Medium", "High"]).withMessage("Invalid priority"),
  query("q")
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Search must be between 1 and 120 characters"),
  query("sort").optional().isIn(["dueAsc", "dueDesc", "newest"]).withMessage("Invalid sort order"),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];

export const analyticsValidation = [
  query("range").optional().isIn(["week", "month", "year"]).withMessage("Range must be week, month, or year"),
  query("timezone").optional().isLength({ min: 1, max: 80 }).withMessage("Invalid timezone"),
];
