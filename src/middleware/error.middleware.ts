import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[Error] ${err.message}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: statusCode < 500 ? err.message : 'Internal server error' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}
