// vrml/utils.ts

/**
 * Formats a number to a string with a specified precision.
 * @param val The number to format.
 * @param precision The number of decimal places.
 * @returns The formatted string.
 */
export function formatCoord(val: number, precision?: number): string {
    if (precision !== undefined) {
        return val.toFixed(precision);
    }
    return val.toString();
}