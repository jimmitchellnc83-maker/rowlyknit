import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FiDownload, FiLoader, FiCheck, FiX, FiAlertCircle, FiSettings, FiFileText } from 'react-icons/fi';

interface Pattern {
  id: string;
  name: string;
  designer?: string;
  category?: string;
  difficulty?: string;
  estimated_yardage?: number;
  yarn_requirements?: string | any[];
  gauge?: string | {
    stitches?: number;
    rows?: number;
    measurement?: string;
  };
  sizes_available?: string | string[];
  notes?: string;
}

interface YarnCalculation {
  baseYardage: number;
  adjustedYardage: number;
  percentageIncrease: number;
  lengthAdjustmentPercent: number;
  widthAdjustmentPercent: number;
}

interface PatternExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pattern: Pattern;
  projectId?: string;
}

export const PatternExportModal: React.FC<PatternExportModalProps> = ({
  isOpen,
  onClose,
  pattern,
  projectId,
}) => {
  // Export options
  const [includeYarnRequirements, setIncludeYarnRequirements] = useState(true);
  const [includeSizeAdjustments, setIncludeSizeAdjustments] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeGauge, setIncludeGauge] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');

  // Size adjustments
  const [lengthAdjustment, setLengthAdjustment] = useState<number>(0);
  const [widthAdjustment, setWidthAdjustment] = useState<number>(0);
  const [adjustmentUnit, setAdjustmentUnit] = useState<'inches' | 'cm'>('inches');

  // UI state
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [yarnCalculation, setYarnCalculation] = useState<YarnCalculation | null>(null);

  // Parse pattern data
  const yarnRequirements = pattern.yarn_requirements
    ? (typeof pattern.yarn_requirements === 'string'
        ? JSON.parse(pattern.yarn_requirements)
        : pattern.yarn_requirements)
    : [];

  const sizesAvailable = pattern.sizes_available
    ? (typeof pattern.sizes_available === 'string'
        ? JSON.parse(pattern.sizes_available)
        : pattern.sizes_available)
    : [];

  const baseYardage =
    (yarnRequirements.length > 0 && yarnRequirements[0].yardage)
      ? yarnRequirements[0].yardage
      : pattern.estimated_yardage || 0;

  // Calculate yarn when adjustments change
  const calculateYarn = useCallback(async () => {
    if (!pattern.id || baseYardage === 0) return;
    if (lengthAdjustment === 0 && widthAdjustment === 0) {
      setYarnCalculation(null);
      return;
    }

    setCalculating(true);
    try {
      const response = await axios.post(`/api/patterns/${pattern.id}/calculate-yarn`, {
        baseYardage,
        lengthAdjustment,
        widthAdjustment,
        adjustmentUnit,
      });

      if (response.data.success) {
        setYarnCalculation(response.data.data);
      }
    } catch (err) {
      console.error('Failed to calculate yarn:', err);
    } finally {
      setCalculating(false);
    }
  }, [pattern.id, baseYardage, lengthAdjustment, widthAdjustment, adjustmentUnit]);

  // Debounce calculation
  useEffect(() => {
    const timer = setTimeout(calculateYarn, 500);
    return () => clearTimeout(timer);
  }, [calculateYarn]);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setExportUrl(null);

    try {
      const response = await axios.post(`/api/patterns/${pattern.id}/export`, {
        projectId,
        includeYarnRequirements,
        includeSizeAdjustments,
        includeNotes,
        includeGauge,
        selectedSize: selectedSize || undefined,
        lengthAdjustment,
        widthAdjustment,
        adjustmentUnit,
      });

      if (response.data.success) {
        setExportUrl(response.data.data.fileUrl);
      } else {
        setError(response.data.error || 'Failed to generate export');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.response?.data?.error || 'Failed to export pattern');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLengthAdjustment(0);
    setWidthAdjustment(0);
    setSelectedSize('');
    setYarnCalculation(null);
    setExportUrl(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiFileText className="header-icon" />
            Export Pattern with Yarn Requirements
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        {error && (
          <div className="error-message">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-content">
          {/* Pattern Info */}
          <div className="pattern-info">
            <h3>{pattern.name}</h3>
            {pattern.designer && <p className="designer">by {pattern.designer}</p>}
            <div className="meta-tags">
              {pattern.category && <span className="tag">{pattern.category}</span>}
              {pattern.difficulty && <span className="tag">{pattern.difficulty}</span>}
            </div>
          </div>

          {/* Current Yarn Info */}
          {baseYardage > 0 && (
            <div className="yarn-info">
              <h4>Current Yarn Requirements</h4>
              <div className="yarn-value">
                <span className="label">Base Yardage:</span>
                <span className="value">{baseYardage} yards</span>
              </div>
              {yarnRequirements.length > 0 && yarnRequirements[0].weight && (
                <div className="yarn-value">
                  <span className="label">Weight:</span>
                  <span className="value">{yarnRequirements[0].weight}</span>
                </div>
              )}
            </div>
          )}

          {/* Size Selection */}
          {sizesAvailable.length > 0 && (
            <div className="form-group">
              <label>Select Size</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
              >
                <option value="">Choose a size...</option>
                {sizesAvailable.map((size: string, index: number) => (
                  <option key={index} value={size}>{size}</option>
                ))}
              </select>
            </div>
          )}

          {/* Size Adjustments */}
          <div className="adjustments-section">
            <h4>
              <FiSettings className="section-icon" />
              Size Adjustments
            </h4>
            <p className="help-text">
              Adjust the length or width to automatically recalculate yarn requirements.
            </p>

            <div className="adjustment-row">
              <div className="form-group">
                <label>Length Adjustment</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={lengthAdjustment}
                    onChange={(e) => setLengthAdjustment(parseFloat(e.target.value) || 0)}
                    step="0.5"
                    placeholder="0"
                  />
                  <span className="unit">{adjustmentUnit === 'cm' ? 'cm' : 'in'}</span>
                </div>
                <span className="hint">+ to add length, - to shorten</span>
              </div>

              <div className="form-group">
                <label>Width Adjustment</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={widthAdjustment}
                    onChange={(e) => setWidthAdjustment(parseFloat(e.target.value) || 0)}
                    step="0.5"
                    placeholder="0"
                  />
                  <span className="unit">{adjustmentUnit === 'cm' ? 'cm' : 'in'}</span>
                </div>
                <span className="hint">+ to widen, - to narrow</span>
              </div>
            </div>

            <div className="unit-toggle">
              <button
                className={adjustmentUnit === 'inches' ? 'active' : ''}
                onClick={() => setAdjustmentUnit('inches')}
              >
                Inches
              </button>
              <button
                className={adjustmentUnit === 'cm' ? 'active' : ''}
                onClick={() => setAdjustmentUnit('cm')}
              >
                Centimeters
              </button>
            </div>
          </div>

          {/* Calculated Yarn Display */}
          {yarnCalculation && (
            <div className="calculation-result">
              <h4>Adjusted Yarn Calculation</h4>
              <div className="calculation-details">
                <div className="calc-row">
                  <span className="label">Original:</span>
                  <span className="value">{yarnCalculation.baseYardage} yards</span>
                </div>
                <div className="calc-row adjustment">
                  <span className="label">Adjustment:</span>
                  <span className={`value ${yarnCalculation.percentageIncrease >= 0 ? 'positive' : 'negative'}`}>
                    {yarnCalculation.percentageIncrease >= 0 ? '+' : ''}{yarnCalculation.percentageIncrease.toFixed(1)}%
                  </span>
                </div>
                <div className="calc-row result">
                  <span className="label">Adjusted Total:</span>
                  <span className="value highlight">{yarnCalculation.adjustedYardage} yards</span>
                </div>
              </div>
              {calculating && <span className="calculating">Calculating...</span>}
            </div>
          )}

          {/* Export Options */}
          <div className="export-options">
            <h4>Export Options</h4>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={includeYarnRequirements}
                  onChange={(e) => setIncludeYarnRequirements(e.target.checked)}
                />
                Include yarn requirements
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeSizeAdjustments}
                  onChange={(e) => setIncludeSizeAdjustments(e.target.checked)}
                />
                Include size adjustments in calculations
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeGauge}
                  onChange={(e) => setIncludeGauge(e.target.checked)}
                />
                Include gauge information
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                Include pattern notes
              </label>
            </div>
          </div>

          {/* Export Success */}
          {exportUrl && (
            <div className="export-success">
              <FiCheck className="success-icon" />
              <span>PDF generated successfully!</span>
              <a
                href={exportUrl}
                download
                className="download-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FiDownload /> Download PDF
              </a>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? (
              <>
                <FiLoader className="spin" /> Generating...
              </>
            ) : (
              <>
                <FiDownload /> Export PDF
              </>
            )}
          </button>
        </div>

        <style>{`
          .export-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .export-modal {
            background: white;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal-header h2 {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
          }

          .header-icon {
            color: #3b82f6;
          }

          .close-btn {
            background: none;
            border: none;
            padding: 8px;
            cursor: pointer;
            color: #6b7280;
            border-radius: 6px;
          }

          .close-btn:hover {
            background-color: #f3f4f6;
          }

          .error-message {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            background-color: #fef2f2;
            border-bottom: 1px solid #fecaca;
            color: #991b1b;
            font-size: 14px;
          }

          .modal-content {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .pattern-info h3 {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 4px 0;
          }

          .designer {
            font-size: 14px;
            color: #6b7280;
            margin: 0 0 8px 0;
          }

          .meta-tags {
            display: flex;
            gap: 8px;
          }

          .tag {
            display: inline-block;
            padding: 4px 10px;
            background-color: #f3f4f6;
            border-radius: 4px;
            font-size: 12px;
            color: #4b5563;
            text-transform: capitalize;
          }

          .yarn-info {
            padding: 16px;
            background-color: #f0f9ff;
            border-radius: 8px;
            border: 1px solid #bae6fd;
          }

          .yarn-info h4 {
            font-size: 14px;
            font-weight: 600;
            color: #0369a1;
            margin: 0 0 12px 0;
          }

          .yarn-value {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            margin-bottom: 8px;
          }

          .yarn-value:last-child {
            margin-bottom: 0;
          }

          .yarn-value .label {
            color: #0369a1;
          }

          .yarn-value .value {
            font-weight: 600;
            color: #0c4a6e;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .form-group label {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
          }

          .form-group select,
          .form-group input {
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
          }

          .form-group select:focus,
          .form-group input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .adjustments-section {
            padding: 16px;
            background-color: #fafafa;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .adjustments-section h4 {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0 0 8px 0;
          }

          .section-icon {
            color: #6b7280;
          }

          .help-text {
            font-size: 13px;
            color: #6b7280;
            margin: 0 0 16px 0;
          }

          .adjustment-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }

          .input-with-unit {
            display: flex;
            align-items: center;
          }

          .input-with-unit input {
            flex: 1;
            border-radius: 6px 0 0 6px;
          }

          .input-with-unit .unit {
            padding: 10px 12px;
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            border-left: none;
            border-radius: 0 6px 6px 0;
            font-size: 14px;
            color: #6b7280;
          }

          .hint {
            font-size: 11px;
            color: #9ca3af;
          }

          .unit-toggle {
            display: flex;
            gap: 8px;
          }

          .unit-toggle button {
            flex: 1;
            padding: 8px;
            border: 1px solid #d1d5db;
            background-color: white;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .unit-toggle button:hover {
            background-color: #f9fafb;
          }

          .unit-toggle button.active {
            background-color: #3b82f6;
            color: white;
            border-color: #3b82f6;
          }

          .calculation-result {
            padding: 16px;
            background-color: #f0fdf4;
            border-radius: 8px;
            border: 1px solid #86efac;
          }

          .calculation-result h4 {
            font-size: 14px;
            font-weight: 600;
            color: #166534;
            margin: 0 0 12px 0;
          }

          .calculation-details {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .calc-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
          }

          .calc-row .label {
            color: #166534;
          }

          .calc-row .value {
            font-weight: 500;
          }

          .calc-row .value.positive {
            color: #ea580c;
          }

          .calc-row .value.negative {
            color: #0284c7;
          }

          .calc-row.result {
            padding-top: 8px;
            border-top: 1px dashed #86efac;
            margin-top: 4px;
          }

          .calc-row .value.highlight {
            font-weight: 700;
            font-size: 16px;
            color: #15803d;
          }

          .calculating {
            font-size: 12px;
            color: #6b7280;
            font-style: italic;
          }

          .export-options h4 {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 12px 0;
          }

          .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            cursor: pointer;
          }

          .checkbox-group input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .export-success {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background-color: #f0fdf4;
            border-radius: 8px;
            border: 1px solid #86efac;
          }

          .success-icon {
            color: #16a34a;
            font-size: 20px;
          }

          .download-link {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background-color: #16a34a;
            color: white;
            border-radius: 6px;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
          }

          .download-link:hover {
            background-color: #15803d;
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
          }

          .btn-primary,
          .btn-secondary {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
          }

          .btn-primary {
            background-color: #3b82f6;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background-color: #2563eb;
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-secondary {
            background-color: white;
            color: #374151;
            border: 1px solid #d1d5db;
          }

          .btn-secondary:hover {
            background-color: #f9fafb;
          }

          .spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @media (max-width: 600px) {
            .adjustment-row {
              grid-template-columns: 1fr;
            }

            .modal-actions {
              flex-direction: column;
            }

            .btn-primary,
            .btn-secondary {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default PatternExportModal;
