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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const chartSharingController = __importStar(require("../controllers/chartSharingController"));
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
/**
 * Public Shared Content Routes
 * These routes do NOT require authentication
 */
/**
 * @route   GET /shared/chart/:token
 * @desc    View shared chart (public)
 * @access  Public
 */
router.get('/chart/:token', [(0, express_validator_1.query)('password').optional().isString()], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartSharingController.viewSharedChart));
/**
 * @route   GET /shared/chart/:token/download
 * @desc    Download shared chart (public)
 * @access  Public
 */
router.get('/chart/:token/download', [
    (0, express_validator_1.query)('format').optional().isIn(['pdf', 'png', 'csv']),
    (0, express_validator_1.query)('password').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartSharingController.downloadSharedChart));
exports.default = router;
