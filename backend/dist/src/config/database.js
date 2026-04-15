"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const knex_1 = __importDefault(require("knex"));
const knexfile_1 = __importDefault(require("../../knexfile"));
const logger_1 = __importDefault(require("./logger"));
const environment = process.env.NODE_ENV || 'development';
const config = knexfile_1.default[environment];
const db = (0, knex_1.default)(config);
// Test connection
db.raw('SELECT 1')
    .then(() => {
    logger_1.default.info('Database connection established');
})
    .catch((err) => {
    logger_1.default.error('Database connection failed', { error: err.message });
    process.exit(1);
});
exports.default = db;
