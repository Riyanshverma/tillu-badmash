import { z } from "zod";

/**
 * Common Zod validators and domain primitives mirroring backend/CONTRACTS.md.
 */

// Timezone-aware ISO-8601 string (e.g. "2026-01-15T09:20:00Z" or with offset)
export const isoDateTimeSchema = z.string().datetime({ offset: true });

// ISO-8601 Calendar Date (YYYY-MM-DD)
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid ISO date (YYYY-MM-DD)");

// Delivery hour within a day (0 to 23)
export const hourSchema = z.number().int().min(0).max(23);

// Power in MW - non-negative finite value
export const mwNonNegativeSchema = z.number().finite().nonnegative();

// Power in MW - signed finite value (used for error, bias, etc.)
export const mwSchema = z.number().finite();

// Percentage value (0 to 100)
export const percentSchema = z.number().finite().min(0).max(100);

// WAPE percentage - non-negative finite value without upper ceiling, or null if actual denominator is zero
export const wapeSchema = z.number().finite().nonnegative().nullable();
