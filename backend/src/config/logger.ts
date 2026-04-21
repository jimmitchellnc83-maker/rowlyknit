import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// PII / credential redaction. Any meta key that matches this regex has its
// value replaced with '[REDACTED]' before the log line is serialized. Applied
// recursively so nested objects (e.g. `{ user: { password: 'x' } }`) are safe.
const REDACT_KEYS =
  /^(password|currentpassword|newpassword|confirmpassword|token|accesstoken|refreshtoken|authtoken|bearertoken|jwt|jwtsecret|jwtrefreshsecret|csrfsecret|sessionsecret|apikey|api_key|authorization|cookie|setcookie|set-cookie|x-auth-token)$/i;

const REDACTED = '[REDACTED]';

function redactDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactDeep);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACT_KEYS.test(key) ? REDACTED : redactDeep(val);
  }
  return out;
}

// Winston format that redacts the whole info object (top-level + nested) in
// place. Runs before json/console serialization.
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (REDACT_KEYS.test(key)) {
      (info as Record<string, unknown>)[key] = REDACTED;
    } else {
      (info as Record<string, unknown>)[key] = redactDeep(
        (info as Record<string, unknown>)[key]
      );
    }
  }
  return info;
})();

// Custom format for structured logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  redactFormat,
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactFormat,
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: isProduction ? jsonFormat : consoleFormat,
  }),
];

// Add file transports in production
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join('/var/log/rowly', 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('/var/log/rowly', 'combined.log'),
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
