import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FiArrowLeft, FiCheck, FiLoader, FiX, FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface GaugeData {
  stitches: number;
  rows: number;
  measurement: number;
}

interface GaugeComparison {
  stitch_difference_percent: number;
  row_difference_percent: number;
  needs_adjustment: boolean;
  stitch_multiplier: number;
  row_multiplier: number;
}

interface GaugeAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pattern: {
    id: string;
    name: string;
    notes?: string;
    gauge?: string;
  };
  projectId: string;
  onAdjustmentApplied: () => void;
}

type Step = 'input' | 'preview';

export const GaugeAdjustmentModal: React.FC<GaugeAdjustmentModalProps> = ({
  isOpen,
  onClose,
  pattern,
  projectId,
  onAdjustmentApplied,
}) => {
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gauge inputs
  const [patternGauge, setPatternGauge] = useState<GaugeData>({
    stitches: 22,
    rows: 30,
    measurement: 4,
  });
  const [actualGauge, setActualGauge] = useState<GaugeData>({
    stitches: 22,
    rows: 30,
    measurement: 4,
  });

  // Calculation results
  const [comparison, setComparison] = useState<GaugeComparison | null>(null);
  const [originalInstructions, setOriginalInstructions] = useState('');
  const [adjustedInstructions, setAdjustedInstructions] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  // Parse pattern gauge on mount
  useEffect(() => {
    if (pattern.gauge) {
      // Try to parse gauge string like "22 sts and 30 rows = 4 inches"
      const match = pattern.gauge.match(/(\d+(?:\.\d+)?)\s*(?:sts?|stitches?).*?(\d+(?:\.\d+)?)\s*rows?.*?(\d+)/i);
      if (match) {
        const parsed = {
          stitches: parseFloat(match[1]),
          rows: parseFloat(match[2]),
          measurement: parseInt(match[3], 10),
        };
        setPatternGauge(parsed);
        setActualGauge({ ...parsed });
      }
    }
  }, [pattern.gauge]);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const response = await axios.post(`/api/patterns/${pattern.id}/calculate-adjustment`, {
        pattern_gauge: patternGauge,
        actual_gauge: actualGauge,
      });

      if (response.data.success) {
        const { data } = response.data;
        setComparison(data.comparison);
        setOriginalInstructions(data.original_instructions);
        setAdjustedInstructions(data.adjusted_instructions);
        setWarning(data.warning || null);
        setStep('preview');
      } else {
        setError(response.data.error || 'Failed to calculate adjustment');
      }
    } catch (err: any) {
      console.error('Calculation error:', err);
      setError(err.response?.data?.error || 'Failed to calculate gauge adjustment');
    } finally {
      setLoading(false);
    }
  }, [pattern.id, patternGauge, actualGauge]);

  const handleApply = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`/api/projects/${projectId}/apply-gauge-adjustment`, {
        pattern_gauge: patternGauge,
        actual_gauge: actualGauge,
        adjusted_instructions: adjustedInstructions,
        original_instructions: originalInstructions,
      });

      if (response.data.success) {
        onAdjustmentApplied();
        onClose();
      } else {
        setError(response.data.error || 'Failed to apply adjustment');
      }
    } catch (err: any) {
      console.error('Apply error:', err);
      setError(err.response?.data?.error || 'Failed to apply gauge adjustment');
    } finally {
      setLoading(false);
    }
  }, [projectId, patternGauge, actualGauge, adjustedInstructions, originalInstructions, onAdjustmentApplied, onClose]);

  const handleReset = () => {
    setStep('input');
    setComparison(null);
    setAdjustedInstructions('');
    setWarning(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="gauge-modal-overlay" onClick={onClose}>
      <div className="gauge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Gauge Adjustment</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        {error && (
          <div className="error-message">
            <FiAlertTriangle />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-content">
          {step === 'input' && (
            <div className="step-input">
              <p className="description">
                Enter your actual gauge from your gauge swatch to automatically adjust the pattern numbers.
              </p>

              <div className="gauge-inputs">
                <div className="gauge-section">
                  <h4>Pattern Gauge</h4>
                  <div className="gauge-row">
                    <input
                      type="number"
                      value={patternGauge.stitches}
                      onChange={(e) =>
                        setPatternGauge({ ...patternGauge, stitches: parseFloat(e.target.value) || 0 })
                      }
                      step="0.5"
                      min="1"
                    />
                    <span>stitches</span>
                    <span className="separator">and</span>
                    <input
                      type="number"
                      value={patternGauge.rows}
                      onChange={(e) =>
                        setPatternGauge({ ...patternGauge, rows: parseFloat(e.target.value) || 0 })
                      }
                      step="0.5"
                      min="1"
                    />
                    <span>rows</span>
                    <span className="separator">=</span>
                    <input
                      type="number"
                      value={patternGauge.measurement}
                      onChange={(e) =>
                        setPatternGauge({ ...patternGauge, measurement: parseInt(e.target.value, 10) || 4 })
                      }
                      min="1"
                    />
                    <span>inches</span>
                  </div>
                </div>

                <div className="gauge-section">
                  <h4>Your Actual Gauge</h4>
                  <div className="gauge-row">
                    <input
                      type="number"
                      value={actualGauge.stitches}
                      onChange={(e) =>
                        setActualGauge({ ...actualGauge, stitches: parseFloat(e.target.value) || 0 })
                      }
                      step="0.5"
                      min="1"
                    />
                    <span>stitches</span>
                    <span className="separator">and</span>
                    <input
                      type="number"
                      value={actualGauge.rows}
                      onChange={(e) =>
                        setActualGauge({ ...actualGauge, rows: parseFloat(e.target.value) || 0 })
                      }
                      step="0.5"
                      min="1"
                    />
                    <span>rows</span>
                    <span className="separator">=</span>
                    <input
                      type="number"
                      value={actualGauge.measurement}
                      onChange={(e) =>
                        setActualGauge({ ...actualGauge, measurement: parseInt(e.target.value, 10) || 4 })
                      }
                      min="1"
                    />
                    <span>inches</span>
                  </div>
                </div>
              </div>

              <div className="info-box">
                <FiInfo />
                <span>
                  Make sure to measure your gauge swatch after blocking for accurate results.
                </span>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleCalculate}
                  disabled={loading || patternGauge.stitches <= 0 || actualGauge.stitches <= 0}
                >
                  {loading ? (
                    <>
                      <FiLoader className="spin" /> Calculating...
                    </>
                  ) : (
                    'Calculate Adjustment'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && comparison && (
            <div className="step-preview">
              {warning && (
                <div className="warning-message">
                  <FiAlertTriangle />
                  <span>{warning}</span>
                </div>
              )}

              <div className="gauge-comparison">
                <h4>Gauge Difference</h4>
                <div className="comparison-stats">
                  <div className="stat">
                    <span className="stat-label">Stitches</span>
                    <span
                      className={`stat-value ${
                        comparison.stitch_difference_percent > 0
                          ? 'positive'
                          : comparison.stitch_difference_percent < 0
                          ? 'negative'
                          : ''
                      }`}
                    >
                      {comparison.stitch_difference_percent > 0 ? '+' : ''}
                      {comparison.stitch_difference_percent}%
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Rows</span>
                    <span
                      className={`stat-value ${
                        comparison.row_difference_percent > 0
                          ? 'positive'
                          : comparison.row_difference_percent < 0
                          ? 'negative'
                          : ''
                      }`}
                    >
                      {comparison.row_difference_percent > 0 ? '+' : ''}
                      {comparison.row_difference_percent}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="instructions-comparison">
                <div className="comparison-column">
                  <h4>Original Instructions</h4>
                  <pre className="instructions-text">{originalInstructions || 'No instructions available'}</pre>
                </div>

                <div className="comparison-column">
                  <h4>Adjusted Instructions</h4>
                  <textarea
                    className="instructions-text editable"
                    value={adjustedInstructions}
                    onChange={(e) => setAdjustedInstructions(e.target.value)}
                    rows={15}
                  />
                  <p className="help-text">Review and edit as needed before saving</p>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleReset}>
                  <FiArrowLeft /> Back
                </button>
                <button className="btn-primary" onClick={handleApply} disabled={loading}>
                  {loading ? (
                    <>
                      <FiLoader className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <FiCheck /> Use Adjusted Pattern
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{`
          .gauge-modal-overlay {
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

          .gauge-modal {
            background: white;
            border-radius: 12px;
            max-width: 900px;
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
            font-size: 20px;
            font-weight: 600;
            margin: 0;
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

          .error-message,
          .warning-message {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            font-size: 14px;
          }

          .error-message {
            background-color: #fef2f2;
            border-bottom: 1px solid #fecaca;
            color: #991b1b;
          }

          .warning-message {
            background-color: #fffbeb;
            border: 1px solid #fbbf24;
            border-radius: 8px;
            color: #92400e;
            margin-bottom: 16px;
          }

          .modal-content {
            padding: 24px;
          }

          .description {
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.6;
          }

          .gauge-inputs {
            display: flex;
            flex-direction: column;
            gap: 24px;
            margin-bottom: 24px;
          }

          .gauge-section h4 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #374151;
          }

          .gauge-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .gauge-row input {
            width: 70px;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            text-align: center;
            font-size: 16px;
          }

          .gauge-row input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .gauge-row span {
            font-size: 14px;
            color: #6b7280;
          }

          .gauge-row .separator {
            color: #9ca3af;
          }

          .info-box {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 16px;
            background-color: #f0f9ff;
            border-radius: 8px;
            font-size: 13px;
            color: #0369a1;
            margin-bottom: 24px;
          }

          .info-box svg {
            flex-shrink: 0;
            margin-top: 2px;
          }

          .gauge-comparison {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 24px;
          }

          .gauge-comparison h4 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 16px;
          }

          .comparison-stats {
            display: flex;
            gap: 32px;
          }

          .stat {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .stat-label {
            font-size: 13px;
            color: #6b7280;
          }

          .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #374151;
          }

          .stat-value.positive {
            color: #16a34a;
          }

          .stat-value.negative {
            color: #dc2626;
          }

          .instructions-comparison {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }

          .comparison-column h4 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
          }

          .instructions-text {
            width: 100%;
            padding: 16px;
            background: #fafafa;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.6;
            max-height: 350px;
            overflow-y: auto;
            white-space: pre-wrap;
          }

          .instructions-text.editable {
            background: white;
            resize: vertical;
            min-height: 200px;
          }

          .instructions-text.editable:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .help-text {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 8px;
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
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

          @media (max-width: 768px) {
            .gauge-modal {
              max-height: 100vh;
              border-radius: 0;
            }

            .gauge-row {
              justify-content: center;
            }

            .instructions-comparison {
              grid-template-columns: 1fr;
            }

            .comparison-stats {
              flex-direction: column;
              gap: 16px;
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

export default GaugeAdjustmentModal;
