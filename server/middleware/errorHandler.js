import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { config } from '../config/env.js';

export function notFound(request, _response, next) {
  next(new AppError(404, `Route not found: ${request.method} ${request.path}`));
}

export function errorHandler(error, _request, response, _next) {
  let status = error.status || 500;
  let message = error.message || 'An unexpected server error occurred.';
  let details = error.details;

  if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Request data failed model validation.';
    details = Object.fromEntries(Object.entries(error.errors).map(([field, issue]) => [field, issue.message]));
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'A request identifier or value is invalid.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'A record with that value already exists.';
    details = Object.keys(error.keyPattern || {});
  }

  if (status >= 500) {
    console.error(error);
    if (config.nodeEnv === 'production') {
      message = 'An unexpected server error occurred.';
      details = undefined;
    }
  }

  response.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}
