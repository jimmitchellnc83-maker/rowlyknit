import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Pattern {
  id: string;
  name: string;
  designer?: string;
  category?: string;
}

interface CollationResult {
  id: string;
  fileUrl: string;
  pageCount: number;
  fileSize: number;
  patternCount: number;
}

export const PDFCollation: React.FC = () => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [addDividers, setAddDividers] = useState(false);
  const [dividerText, setDividerText] = useState('Pattern');
  const [loading, setLoading] = useState(false);
  const [collationResult, setCollationResult] = useState<CollationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    try {
      const response = await axios.get('/api/patterns');
      if (response.data.success) {
        setPatterns(response.data.data.patterns);
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
      setError('Failed to load patterns');
    }
  };

  const handlePatternToggle = (patternId: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(patternId)
        ? prev.filter((id) => id !== patternId)
        : [...prev, patternId]
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...selectedPatterns];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSelectedPatterns(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedPatterns.length - 1) return;
    const newOrder = [...selectedPatterns];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSelectedPatterns(newOrder);
  };

  const handleCollate = async () => {
    if (selectedPatterns.length === 0) {
      setError('Please select at least one pattern');
      return;
    }

    setLoading(true);
    setError(null);
    setCollationResult(null);

    try {
      const response = await axios.post('/api/patterns/collate', {
        patternIds: selectedPatterns,
        addDividers,
        dividerText,
      });

      if (response.data.success) {
        setCollationResult(response.data.data.collation);
      }
    } catch (err: any) {
      console.error('Failed to collate patterns:', err);
      setError(err.response?.data?.message || 'Failed to merge PDFs');
    } finally {
      setLoading(false);
    }
  };

  const getPatternName = (patternId: string) => {
    const pattern = patterns.find((p) => p.id === patternId);
    return pattern?.name || 'Unknown Pattern';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="pdf-collation">
      <div className="collation-header">
        <h2>Merge Pattern PDFs</h2>
        <p className="description">
          Select multiple patterns to merge into a single PDF file
        </p>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="collation-content">
        {/* Pattern Selection */}
        <div className="pattern-selection">
          <h3>Available Patterns</h3>
          <div className="pattern-list">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className={`pattern-item ${selectedPatterns.includes(pattern.id) ? 'selected' : ''}`}
                onClick={() => handlePatternToggle(pattern.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedPatterns.includes(pattern.id)}
                  onChange={() => handlePatternToggle(pattern.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="pattern-info">
                  <div className="pattern-name">{pattern.name}</div>
                  {pattern.designer && (
                    <div className="pattern-designer">by {pattern.designer}</div>
                  )}
                  {pattern.category && (
                    <span className="pattern-category">{pattern.category}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Patterns Order */}
        {selectedPatterns.length > 0 && (
          <div className="selected-patterns">
            <h3>Merge Order ({selectedPatterns.length} patterns)</h3>
            <div className="pattern-order-list">
              {selectedPatterns.map((patternId, index) => (
                <div key={patternId} className="pattern-order-item">
                  <span className="order-number">{index + 1}.</span>
                  <span className="pattern-name">{getPatternName(patternId)}</span>
                  <div className="order-controls">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="btn-icon"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === selectedPatterns.length - 1}
                      className="btn-icon"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handlePatternToggle(patternId)}
                      className="btn-icon btn-remove"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="collation-options">
          <h3>Options</h3>
          <div className="option">
            <label>
              <input
                type="checkbox"
                checked={addDividers}
                onChange={(e) => setAddDividers(e.target.checked)}
              />
              Add divider pages between patterns
            </label>
          </div>
          {addDividers && (
            <div className="option">
              <label>
                Divider text:
                <input
                  type="text"
                  value={dividerText}
                  onChange={(e) => setDividerText(e.target.value)}
                  placeholder="Pattern"
                  maxLength={255}
                />
              </label>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="collation-actions">
          <button
            onClick={handleCollate}
            disabled={loading || selectedPatterns.length === 0}
            className="btn-primary"
          >
            {loading ? 'Merging PDFs...' : 'Merge PDFs'}
          </button>
          {selectedPatterns.length > 0 && (
            <button
              onClick={() => setSelectedPatterns([])}
              className="btn-secondary"
              disabled={loading}
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Result */}
        {collationResult && (
          <div className="collation-result">
            <h3>✓ PDF Merged Successfully!</h3>
            <div className="result-info">
              <p>
                <strong>Patterns merged:</strong> {collationResult.patternCount}
              </p>
              <p>
                <strong>Total pages:</strong> {collationResult.pageCount}
              </p>
              <p>
                <strong>File size:</strong> {formatFileSize(collationResult.fileSize)}
              </p>
            </div>
            <div className="result-actions">
              <a
                href={collationResult.fileUrl}
                download
                className="btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Merged PDF
              </a>
              <button
                onClick={() => {
                  setCollationResult(null);
                  setSelectedPatterns([]);
                }}
                className="btn-secondary"
              >
                Merge More Patterns
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .pdf-collation {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .collation-header {
          margin-bottom: 30px;
        }

        .collation-header h2 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .description {
          color: #6b7280;
          font-size: 14px;
        }

        .error-message {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .collation-content {
          display: grid;
          gap: 30px;
        }

        .pattern-selection h3,
        .selected-patterns h3,
        .collation-options h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .pattern-list {
          display: grid;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .pattern-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pattern-item:hover {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }

        .pattern-item.selected {
          border-color: #3b82f6;
          background-color: #dbeafe;
        }

        .pattern-item input[type='checkbox'] {
          margin-top: 2px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .pattern-info {
          flex: 1;
        }

        .pattern-name {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .pattern-designer {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .pattern-category {
          display: inline-block;
          font-size: 12px;
          padding: 2px 8px;
          background-color: #f3f4f6;
          border-radius: 4px;
          color: #4b5563;
        }

        .pattern-order-list {
          display: grid;
          gap: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .pattern-order-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background-color: #f9fafb;
          border-radius: 6px;
        }

        .order-number {
          font-weight: 600;
          color: #6b7280;
          min-width: 30px;
        }

        .pattern-order-item .pattern-name {
          flex: 1;
        }

        .order-controls {
          display: flex;
          gap: 4px;
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          border: 1px solid #d1d5db;
          background-color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-icon:hover:not(:disabled) {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }

        .btn-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-icon.btn-remove {
          color: #dc2626;
          font-size: 24px;
        }

        .btn-icon.btn-remove:hover:not(:disabled) {
          background-color: #fef2f2;
          border-color: #fca5a5;
        }

        .collation-options {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
        }

        .option {
          margin-bottom: 16px;
        }

        .option:last-child {
          margin-bottom: 0;
        }

        .option label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .option input[type='checkbox'] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .option input[type='text'] {
          margin-left: 8px;
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .collation-actions {
          display: flex;
          gap: 12px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 14px;
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

        .btn-secondary:hover:not(:disabled) {
          background-color: #f9fafb;
        }

        .collation-result {
          background-color: #f0fdf4;
          border: 2px solid #86efac;
          border-radius: 8px;
          padding: 24px;
        }

        .collation-result h3 {
          color: #166534;
          font-size: 20px;
          margin-bottom: 16px;
        }

        .result-info {
          margin-bottom: 20px;
        }

        .result-info p {
          margin-bottom: 8px;
          font-size: 14px;
          color: #166534;
        }

        .result-actions {
          display: flex;
          gap: 12px;
        }

        .result-actions a {
          text-decoration: none;
        }

        @media (max-width: 768px) {
          .pdf-collation {
            padding: 16px;
          }

          .collation-header h2 {
            font-size: 20px;
          }

          .collation-actions {
            flex-direction: column;
          }

          .result-actions {
            flex-direction: column;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default PDFCollation;
