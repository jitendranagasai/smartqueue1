import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response.js';

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.body = validated.body ?? req.body;
      req.query = validated.query ?? req.query;
      req.params = validated.params ?? req.params;
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errorMessages = err.errors.map(e => ({
          field: e.path.join('.').replace(/^(body|query|params)\./, ''),
          message: e.message
        }));
        return sendError(res, errorMessages[0]?.message || 'Validation failed', 400, errorMessages);
      }
      return sendError(res, err.message || 'Validation error', 400);
    }
  };
};
