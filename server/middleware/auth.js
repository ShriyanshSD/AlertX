import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

export function readToken(request) {
  if (request.cookies?.resq_token) return request.cookies.resq_token;
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return null;
}

export const authenticate = asyncHandler(async (request, _response, next) => {
  const token = readToken(request);
  if (!token) throw new AppError(401, 'Authentication is required.');

  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret, { issuer: 'resq-api', audience: 'resq-client' });
  } catch {
    throw new AppError(401, 'Your session is invalid or has expired.');
  }

  const user = await User.findById(claims.sub);
  if (!user) throw new AppError(401, 'Your account is no longer available.');
  request.user = user;
  return next();
});
