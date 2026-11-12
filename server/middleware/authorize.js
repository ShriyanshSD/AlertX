import AppError from '../utils/AppError.js';

export default function authorize(...roles) {
  return function authorizeRole(request, _response, next) {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}
