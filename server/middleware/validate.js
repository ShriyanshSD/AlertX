import AppError from '../utils/AppError.js';

export default function validate(schemas) {
  return function validateRequest(request, _response, next) {
    const errors = {};
    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(request[part]);
      if (result.success) {
        Object.defineProperty(request, part, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: result.data,
        });
      } else {
        errors[part] = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
      }
    }
    if (Object.keys(errors).length) {
      return next(new AppError(400, 'Request validation failed.', errors));
    }
    return next();
  };
}
