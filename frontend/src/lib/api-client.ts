import { z } from "zod";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

export class ContractValidationError extends Error {
  constructor(
    public zodError: z.ZodError,
    public rawData: unknown
  ) {
    super("The API returned data in an unexpected format.");
    this.name = "ContractValidationError";
  }
}

/**
 * Fetch and validate a JSON response using a Zod schema.
 */
export async function fetchAndValidate<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      // Body not JSON
    }
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  const rawJson = await response.json();
  const parseResult = schema.safeParse(rawJson);

  if (!parseResult.success) {
    console.error("Contract validation failed for", endpoint, parseResult.error);
    throw new ContractValidationError(parseResult.error, rawJson);
  }

  return parseResult.data;
}
