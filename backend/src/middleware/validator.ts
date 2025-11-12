import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from '../utils/errorHandler';
import validator from 'validator';

/**
 * Middleware to check validation results from express-validator
 */
export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  next();
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return validator.escape(obj.trim());
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate UUID parameter
 */
export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];

    if (!value || !validator.isUUID(value)) {
      throw new ValidationError(`Invalid ${paramName}: must be a valid UUID`);
    }

    next();
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (page < 1) {
    throw new ValidationError('Page must be greater than 0');
  }

  if (limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
}

/**
 * Validate and sanitize search query
 */
export function validateSearch(req: Request, res: Response, next: NextFunction) {
  if (req.query.search) {
    const search = req.query.search as string;

    // Limit search query length
    if (search.length > 100) {
      throw new ValidationError('Search query must be less than 100 characters');
    }

    // Sanitize
    req.query.search = validator.escape(search.trim());
  }

  next();
}
