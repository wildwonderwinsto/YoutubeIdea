/**
 * Production-safe logging utility
 * Only logs in development mode to avoid exposing sensitive information in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
    error: (...args: unknown[]) => {
        if (isDevelopment) {
            console.error(...args);
        }
        // In production, you could send to an error tracking service
    },
    warn: (...args: unknown[]) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },
    log: (...args: unknown[]) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
    info: (...args: unknown[]) => {
        if (isDevelopment) {
            console.info(...args);
        }
    },
};
