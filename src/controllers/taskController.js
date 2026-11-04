import * as taskService from "../services/taskService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successResponse } from "../utils/response.js";

export const create = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.user._id, req.body);
  return successResponse(res, { statusCode: 201, message: "Task created successfully", data: task });
});

export const list = asyncHandler(async (req, res) => {
  const { tasks, meta } = await taskService.listTasks(req.user._id, req.query);
  return successResponse(res, { message: "Tasks loaded successfully", data: tasks, meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.user._id, req.params.id);
  return successResponse(res, { message: "Task loaded successfully", data: task });
});

export const update = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.user._id, req.params.id, req.body);
  return successResponse(res, { message: "Task updated successfully", data: task });
});

export const remove = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.user._id, req.params.id);
  return successResponse(res, { message: "Task deleted successfully", data: null });
});

export const search = asyncHandler(async (req, res) => {
  const { tasks, meta } = await taskService.searchTasks(req.user._id, req.query.q.trim(), req.query);
  return successResponse(res, { message: "Search completed", data: tasks, meta });
});

export const weeklySummary = asyncHandler(async (req, res) => {
  const groups = await taskService.getWeeklySummary(req.user._id, req.query.timezone);
  return successResponse(res, { message: "Weekly summary loaded", data: groups });
});

export const analytics = asyncHandler(async (req, res) => {
  const data = await taskService.getAnalytics(req.user._id, req.query.range, req.query.timezone);
  return successResponse(res, { message: "Task analytics loaded", data });
});
