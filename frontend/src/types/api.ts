/**
 * Shared API-related types used across hooks and services.
 */

export interface AppError {
  message: string;
  code?: string | number;
  details?: unknown;
}
