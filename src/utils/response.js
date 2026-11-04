export function successResponse(res, { statusCode = 200, message, data, meta }) {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  });
}
