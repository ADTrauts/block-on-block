import { Request } from 'express';

/**
 * Safely extracts and validates a string query parameter
 * @param req Express request object
 * @param paramName Name of the query parameter
 * @param required Whether the parameter is required
 * @returns The validated string value or undefined
 * @throws Error if parameter is required but missing or invalid
 */
export function getStringQueryParam(
  req: Request,
  paramName: string,
  required = false
): string | undefined {
  const param = req.query[paramName];
  
  if (param === undefined || param === null) {
    if (required) {
      throw new Error(`${paramName} is required`);
    }
    return undefined;
  }
  
  if (typeof param !== 'string') {
    throw new Error(`${paramName} must be a string`);
  }
  
  return param;
}

/**
 * Safely extracts and validates an optional string query parameter
 * @param req Express request object
 * @param paramName Name of the query parameter
 * @returns The validated string value or undefined
 */
export function getOptionalStringQueryParam(
  req: Request,
  paramName: string
): string | undefined {
  return getStringQueryParam(req, paramName, false);
}

/**
 * Safely extracts and validates a required string query parameter
 * @param req Express request object
 * @param paramName Name of the query parameter
 * @returns The validated string value
 * @throws Error if parameter is missing or invalid
 */
export function getRequiredStringQueryParam(
  req: Request,
  paramName: string
): string {
  const value = getStringQueryParam(req, paramName, true);
  if (!value) {
    throw new Error(`${paramName} is required`);
  }
  return value;
}

/**
 * Safely extracts and validates a number query parameter
 * @param req Express request object
 * @param paramName Name of the query parameter
 * @param defaultValue Default value if parameter is missing
 * @returns The validated number value
 */
export function getNumberQueryParam(
  req: Request,
  paramName: string,
  defaultValue?: number
): number | undefined {
  const param = req.query[paramName];
  
  if (param === undefined || param === null) {
    return defaultValue;
  }
  
  if (typeof param === 'string') {
    const parsed = Number(param);
    if (isNaN(parsed)) {
      throw new Error(`${paramName} must be a valid number`);
    }
    return parsed;
  }
  
  if (typeof param === 'number') {
    return param;
  }
  
  throw new Error(`${paramName} must be a number`);
}

