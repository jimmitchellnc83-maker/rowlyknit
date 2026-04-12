"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const knex_1 = __importDefault(require("knex"));
const knexfile_1 = __importDefault(require("../../knexfile"));
const environment = process.env.NODE_ENV || 'development';
const config = knexfile_1.default[environment];
const db = (0, knex_1.default)(config);
// Test connection
db.raw('SELECT 1')
    .then(() => {
    console.log('✓ Database connection established');
})
    .catch((err) => {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
});
exports.default = db;
