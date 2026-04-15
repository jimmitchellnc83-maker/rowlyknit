"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config();
// Validate environment variables before starting app
const validateEnv_1 = require("./utils/validateEnv");
(0, validateEnv_1.validateEnvironmentVariables)();
(0, validateEnv_1.validateSecretStrength)();
// Import configuration
require("./config/database");
require("./config/redis");
const logger_1 = __importStar(require("./config/logger"));
// Import middleware
const rateLimiter_1 = require("./middleware/rateLimiter");
const validator_1 = require("./middleware/validator");
const auditLog_1 = require("./middleware/auditLog");
const errorHandler_1 = require("./utils/errorHandler");
const csrf_1 = require("./middleware/csrf");
const monitoring_1 = require("./middleware/monitoring");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const projects_1 = __importDefault(require("./routes/projects"));
const patterns_1 = __importDefault(require("./routes/patterns"));
const yarn_1 = __importDefault(require("./routes/yarn"));
const recipients_1 = __importDefault(require("./routes/recipients"));
const tools_1 = __importDefault(require("./routes/tools"));
const uploads_1 = __importDefault(require("./routes/uploads"));
const counters_1 = __importDefault(require("./routes/counters"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const pattern_enhancements_1 = __importDefault(require("./routes/pattern-enhancements"));
const notes_1 = __importDefault(require("./routes/notes"));
const magic_markers_1 = __importDefault(require("./routes/magic-markers"));
const patternBookmarks_1 = __importDefault(require("./routes/patternBookmarks"));
const stats_1 = __importDefault(require("./routes/stats"));
const charts_1 = __importDefault(require("./routes/charts"));
const color_planning_1 = __importDefault(require("./routes/color-planning"));
const shared_1 = __importDefault(require("./routes/shared"));
const ravelry_1 = __importDefault(require("./routes/ravelry"));
// Create Express app
const app = (0, express_1.default)();
// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));
// CORS configuration with origin validation
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        // Check if origin is in whitelist
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            logger_1.default.warn(`CORS blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use((0, cors_1.default)(corsOptions));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Cookie parser with CSRF secret for signed cookies
if (!process.env.CSRF_SECRET) {
    throw new Error('Missing required environment variable: CSRF_SECRET. Please set it in your .env file.');
}
app.use((0, cookie_parser_1.default)(process.env.CSRF_SECRET));
// Compression middleware
app.use((0, compression_1.default)());
// HTTP request logging (skip health checks to reduce noise)
app.use((0, morgan_1.default)('combined', {
    stream: logger_1.morganStream,
    skip: (req) => req.url === '/health'
}));
// Request metrics (Prometheus)
app.use(monitoring_1.requestMetrics);
// Input sanitization
app.use(validator_1.sanitizeInput);
// CSRF protection (conditional - skips JWT routes)
app.use(csrf_1.conditionalCsrf);
// Audit logging
app.use(auditLog_1.auditMiddleware);
// Rate limiting
app.use('/api/', rateLimiter_1.apiLimiter);
// Static files (uploads)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'uploads')));
// Import health check handlers
const healthCheck_1 = require("./utils/healthCheck");
// Health check endpoints
app.get('/health', healthCheck_1.healthCheckHandler); // Comprehensive health check
app.get('/health/live', healthCheck_1.livenessProbe); // Kubernetes liveness probe
app.get('/health/ready', healthCheck_1.readinessProbe); // Kubernetes readiness probe
// Metrics endpoint (Prometheus)
app.get('/metrics', monitoring_1.metricsEndpoint);
// CSRF token endpoint
app.get('/api/csrf-token', csrf_1.sendCsrfToken);
// API routes
// Note: More specific routes (sessions, counters, notes) must come BEFORE generic /projects route
app.use('/api/auth', auth_1.default);
app.use('/api', sessions_1.default);
app.use('/api', counters_1.default);
app.use('/api', notes_1.default);
app.use('/api', magic_markers_1.default);
app.use('/api', pattern_enhancements_1.default);
app.use('/api', patternBookmarks_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/patterns', patterns_1.default);
app.use('/api/yarn', yarn_1.default);
app.use('/api/recipients', recipients_1.default);
app.use('/api/tools', tools_1.default);
app.use('/api/uploads', uploads_1.default);
app.use('/api/charts', charts_1.default);
// Legacy alias for /api/chart-symbols -> /api/charts/symbols
app.get('/api/chart-symbols', (req, res, next) => {
    req.url = '/symbols';
    (0, charts_1.default)(req, res, next);
});
app.use('/api', color_planning_1.default);
app.use('/api/ravelry', ravelry_1.default);
app.use('/shared', shared_1.default); // Public shared content routes
// API documentation
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Rowly API',
        version: process.env.API_VERSION || 'v1',
        endpoints: {
            auth: '/api/auth',
            projects: '/api/projects',
            patterns: '/api/patterns',
            yarn: '/api/yarn',
            tools: '/api/tools',
            recipients: '/api/recipients',
        },
    });
});
// 404 handler
app.use(errorHandler_1.notFoundHandler);
// CSRF error handler (must be before global error handler)
app.use(csrf_1.csrfErrorHandler);
// Global error handler
app.use(errorHandler_1.errorHandler);
exports.default = app;
