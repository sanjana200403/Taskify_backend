import { Task } from "../models/Task.js";
import { ApiError } from "../utils/ApiError.js";
import { addCalendarDays, calendarDateToUtc, getCalendarDate, getWeekRange, normalizeTimeZone } from "../utils/date.js";

function pagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function taskPayload(input) {
  return {
    title: input.title,
    description: input.description ?? "",
    scheduledAt: input.scheduledAt,
    priority: input.priority ?? "Medium",
    status: input.status ?? "Pending",
  };
}

function textMatcher(value) {
  const specialCharacters = "\\^$.*+?()[]{}|/";
  let escaped = "";
  for (const character of value.trim()) {
    escaped += specialCharacters.includes(character) ? String.fromCharCode(92) + character : character;
  }
  return new RegExp(escaped, "i");
}

function standardTaskSort(sort) {
  if (sort === "dueDesc") return { scheduledAt: -1, createdAt: -1, _id: -1 };
  if (sort === "newest") return { createdAt: -1, _id: -1 };
  return { scheduledAt: 1, createdAt: -1, _id: -1 };
}

function findSortedTasks(filter, sort, skip, limit) {
  if (sort !== "activeNewest") {
    return Task.find(filter).sort(standardTaskSort(sort)).skip(skip).limit(limit);
  }

  return Task.aggregate([
    { $match: filter },
    {
      $set: {
        sortStatus: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
      },
    },
    { $sort: { sortStatus: 1, createdAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $unset: ["sortStatus", "__v"] },
  ]);
}

export async function createTask(userId, input) {
  return Task.create({ ...taskPayload(input), user: userId });
}

export async function listTasks(userId, query) {
  const { page, limit, skip } = pagination(query);
  const filter = { user: userId };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.q) {
    const matcher = textMatcher(query.q);
    filter.$or = [{ title: matcher }, { description: matcher }];
  }
  if (query.from || query.to) {
    filter.scheduledAt = {};
    if (query.from) filter.scheduledAt.$gte = new Date(query.from);
    if (query.to) filter.scheduledAt.$lte = new Date(query.to);
  }

  const [tasks, total] = await Promise.all([
    findSortedTasks(filter, query.sort, skip, limit),
    Task.countDocuments(filter),
  ]);
  return { tasks, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId, user: userId });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

export async function updateTask(userId, taskId, input) {
  const allowed = Object.fromEntries(
    Object.entries(input).filter(([key]) =>
      ["title", "description", "scheduledAt", "priority", "status"].includes(key),
    ),
  );
  const task = await Task.findOneAndUpdate({ _id: taskId, user: userId }, allowed, {
    new: true,
    runValidators: true,
  });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

export async function deleteTask(userId, taskId) {
  const task = await Task.findOneAndDelete({ _id: taskId, user: userId });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

export async function searchTasks(userId, keyword, query) {
  const { page, limit, skip } = pagination(query);
  const matcher = textMatcher(keyword);
  const filter = { user: userId, $or: [{ title: matcher }, { description: matcher }] };
  const [tasks, total] = await Promise.all([
    findSortedTasks(filter, query.sort || "activeNewest", skip, limit),
    Task.countDocuments(filter),
  ]);
  return { tasks, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getWeeklySummary(userId, timeZoneInput) {
  const timeZone = normalizeTimeZone(timeZoneInput);
  return Task.aggregate([
    { $match: { user: userId } },
    {
      $set: {
        weekStartDate: {
          $dateTrunc: { date: "$scheduledAt", unit: "week", startOfWeek: "monday", timezone: timeZone },
        },
      },
    },
    {
      $group: {
        _id: "$weekStartDate",
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
        openTasks: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 0, 1] } },
      },
    },
    {
      $project: {
        _id: 0,
        weekStart: { $dateToString: { date: "$_id", format: "%Y-%m-%d", timezone: timeZone } },
        weekEnd: {
          $dateToString: {
            date: { $dateAdd: { startDate: "$_id", unit: "day", amount: 6, timezone: timeZone } },
            format: "%Y-%m-%d",
            timezone: timeZone,
          },
        },
        totalTasks: 1,
        completedTasks: 1,
        openTasks: 1,
      },
    },
    { $sort: { weekStart: 1 } },
  ]);
}

function rangeDefinition(range, timeZone) {
  const today = getCalendarDate(new Date(), timeZone);
  const [year, month] = today.split("-").map(Number);

  if (range === "year") {
    return { today, start: year + "-01-01", end: year + "-12-31" };
  }

  if (range === "month") {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthText = String(month).padStart(2, "0");
    return { today, start: year + "-" + monthText + "-01", end: year + "-" + monthText + "-" + lastDay };
  }

  const { weekStart, weekEnd } = getWeekRange(new Date(), timeZone);
  return { today, start: weekStart, end: weekEnd };
}

function createActivity(range, start) {
  if (range === "year") {
    return Array.from({ length: 12 }, (_, index) => ({
      key: String(index + 1).padStart(2, "0"),
      label: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(2000, index, 1)),
      ),
      total: 0,
      completed: 0,
    }));
  }

  if (range === "month") {
    return ["1-7", "8-14", "15-21", "22-28", "29+"].map((label, index) => ({
      key: String(index),
      label,
      total: 0,
      completed: 0,
    }));
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(start, index);
    const label = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(
      new Date(date + "T12:00:00.000Z"),
    );
    return { key: date, label, total: 0, completed: 0 };
  });
}

export async function getAnalytics(userId, rangeInput, timeZoneInput) {
  const range = ["week", "month", "year"].includes(rangeInput) ? rangeInput : "week";
  const timeZone = normalizeTimeZone(timeZoneInput);
  const { today, start, end } = rangeDefinition(range, timeZone);
  const rangeStart = calendarDateToUtc(start, timeZone);
  const rangeEnd = calendarDateToUtc(addCalendarDays(end, 1), timeZone);
  const todayStart = calendarDateToUtc(today, timeZone);
  const dueSoonEnd = calendarDateToUtc(addCalendarDays(today, 8), timeZone);
  const [tasks, overdue, dueSoon] = await Promise.all([
    Task.find({ user: userId, scheduledAt: { $gte: rangeStart, $lt: rangeEnd } })
      .select("title description scheduledAt priority status")
      .sort({ scheduledAt: 1 })
      .lean(),
    Task.countDocuments({ user: userId, status: { $ne: "Completed" }, scheduledAt: { $lt: todayStart } }),
    Task.countDocuments({
      user: userId,
      status: { $ne: "Completed" },
      scheduledAt: { $gte: todayStart, $lt: dueSoonEnd },
    }),
  ]);

  const status = { pending: 0, inProgress: 0, completed: 0 };
  const priority = { low: 0, medium: 0, high: 0 };
  const activity = createActivity(range, start);

  for (const task of tasks) {
    if (task.status === "Completed") status.completed += 1;
    else if (task.status === "In Progress") status.inProgress += 1;
    else status.pending += 1;
    priority[task.priority.toLowerCase()] += 1;

    const date = getCalendarDate(task.scheduledAt, timeZone);
    const activityIndex =
      range === "year"
        ? Number(date.slice(5, 7)) - 1
        : range === "month"
          ? Math.min(Math.floor((Number(date.slice(8, 10)) - 1) / 7), 4)
          : activity.findIndex((item) => item.key === date);
    if (activity[activityIndex]) {
      activity[activityIndex].total += 1;
      if (task.status === "Completed") activity[activityIndex].completed += 1;
    }
  }

  const upcoming = tasks
    .filter((task) => task.status !== "Completed" && getCalendarDate(task.scheduledAt, timeZone) >= today)
    .slice(0, 5);

  return {
    range,
    rangeStart: start,
    rangeEnd: end,
    total: tasks.length,
    status,
    priority,
    completionRate: tasks.length ? Math.round((status.completed / tasks.length) * 100) : 0,
    overdue,
    dueSoon,
    activity,
    upcoming,
  };
}
