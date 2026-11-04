import { ApiError } from "./ApiError.js";

const dateFormatterCache = new Map();
const dateTimeFormatterCache = new Map();

function getFormatter(timeZone) {
  if (!dateFormatterCache.has(timeZone)) {
    try {
      dateFormatterCache.set(
        timeZone,
        new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
      );
    } catch {
      throw new ApiError(400, "Invalid timezone");
    }
  }
  return dateFormatterCache.get(timeZone);
}

function getDateTimeFormatter(timeZone) {
  if (!dateTimeFormatterCache.has(timeZone)) {
    normalizeTimeZone(timeZone);
    dateTimeFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  return dateTimeFormatterCache.get(timeZone);
}

export function normalizeTimeZone(value) {
  const timeZone = value || "UTC";
  getFormatter(timeZone).format(new Date());
  return timeZone;
}

export function getCalendarDate(date, timeZone = "UTC") {
  const parts = getFormatter(normalizeTimeZone(timeZone)).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function calendarDateToUtc(dateString, timeZone = "UTC") {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const [year, month, day] = dateString.split("-").map(Number);
  const desiredTimestamp = Date.UTC(year, month - 1, day);
  let timestamp = desiredTimestamp;

  // Resolve the timezone offset iteratively so DST boundaries are handled by Intl.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getDateTimeFormatter(normalizedTimeZone).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const renderedTimestamp = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    const adjustment = desiredTimestamp - renderedTimestamp;
    timestamp += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(timestamp);
}

export function getWeekRange(date, timeZone = "UTC") {
  const calendarDate = getCalendarDate(date, timeZone);
  const [year, month, day] = calendarDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const weekStart = addCalendarDays(calendarDate, -daysSinceMonday);
  return { weekStart, weekEnd: addCalendarDays(weekStart, 6) };
}
