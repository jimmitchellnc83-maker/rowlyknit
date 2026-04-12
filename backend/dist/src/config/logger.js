"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.morganStream = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
// Custom format for structured logging
const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
        metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
}));
// Create transports
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: isProduction ? jsonFormat : consoleFormat,
    }),
];
// Add file transports in production
if (isProduction) {
    transports.push(new winston_1.default.transports.File({
        filename: path_1.default.join('/var/log/rowly', 'error.log'),
        level: 'error',
        format: jsonFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
    }), new winston_1.default.transports.File({
        filename: path_1.default.join('/var/log/rowly', 'combined.log'),
        format: jsonFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
    }));
}
const logger = winston_1.default.createLogger({
    level: logLevel,
    transports,
    exitOnError: false,
});
// Create a stream for Morgan HTTP logger
exports.morganStream = {
    write: (message) => {
        logger.info(message.trim());
    },
};
exports.default = logger;
