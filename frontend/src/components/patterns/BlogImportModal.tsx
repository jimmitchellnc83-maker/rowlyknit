import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { FiLink, FiLoader, FiCheck, FiX, FiAlertCircle, FiEdit2, FiSave, FiArrowLeft } from 'react-icons/fi';

interface ExtractedContent {
  title: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  content: string;
  textContent: string;
}

interface ParsedPatternData {
  name: string;
  description: string;
  designer: string | null;
  difficulty: string | null;
  category: string | null;
  notes: string;
  yarnRequirements: any[];
  needleSizes: any[];
  gauge: any | null;
  sizesAvailable: string[];
  estimatedYardage: number | null;
}

interface ExtractionResult {
  success: boolean;
  importId: string;
  sourceUrl: string;
  extracted: ExtractedContent;
  parsed: ParsedPatternData;
  metadata?: {
    fetchTime: number;
    contentLength: number;
    statusCode: number;
  };
}

interface BlogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatternImported: (patternId: string) => void;
}

type Step = 'url' | 'preview' | 'success';

export const BlogImportModal: React.FC<BlogImportModalProps> = ({
  isOpen,
  onClose,
  onPatternImported,
}) => {
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [editedPatternData, setEditedPatternData] = useState<ParsedPatternData | null>(null);
  const [savedPatternId, setSavedPatternId] = useState<string | null>(null);

  const handleExtractUrl = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/patterns/import-from-url', { url });

      if (response.data.success) {
        setExtractionResult(response.data);
        setEditedPatternData(response.data.parsed);
        setStep('preview');
      } else {
        setError(response.data.message || 'Failed to extract content');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.response?.data?.message || 'Failed to fetch content from URL');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleSavePattern = useCallback(async () => {
    if (!extractionResult || !editedPatternData) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/patterns/save-imported', {
        importId: extractionResult.importId,
        patternData: editedPatternData,
        sourceUrl: extractionResult.sourceUrl,
      });

      if (response.data.success) {
        setSavedPatternId(response.data.patternId);
        setStep('success');
        onPatternImported(response.data.patternId);
      } else {
        setError(response.data.message || 'Failed to save pattern');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.message || 'Failed to save imported pattern');
    } finally {
      setLoading(false);
    }
  }, [extractionResult, editedPatternData, onPatternImported]);

  const handleFieldChange = (field: keyof ParsedPatternData, value: any) => {
    if (editedPatternData) {
      setEditedPatternData({ ...editedPatternData, [field]: value });
    }
  };

  const handleReset = () => {
    setStep('url');
    setUrl('');
    setError(null);
    setExtractionResult(null);
    setEditedPatternData(null);
    setSavedPatternId(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="blog-import-overlay" onClick={handleClose}>
      <div className="blog-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiLink className="header-icon" />
            Import Pattern from Blog
          </h2>
          <button className="close-btn" onClick={handleClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`step ${step === 'url' ? 'active' : step !== 'url' ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Enter URL</span>
          </div>
          <div className={`step ${step === 'preview' ? 'active' : step === 'success' ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Preview & Edit</span>
          </div>
          <div className={`step ${step === 'success' ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Save</span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-content">
          {/* Step 1: URL Input */}
          {step === 'url' && (
            <div className="step-content url-step">
              <p className="step-description">
                Enter the URL of a blog post containing a knitting pattern. We'll extract the pattern
                details automatically.
              </p>
              <div className="url-input-group">
                <FiLink className="input-icon" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/pattern-post"
                  onKeyDown={(e) => e.key === 'Enter' && handleExtractUrl()}
                  autoFocus
                />
              </div>
              <p className="help-text">
                Works best with knitting blog posts that include pattern details like yarn requirements,
                needle sizes, and gauge information.
              </p>
              <div className="step-actions">
                <button className="btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleExtractUrl}
                  disabled={loading || !url.trim()}
                >
                  {loading ? (
                    <>
                      <FiLoader className="spin" /> Extracting...
                    </>
                  ) : (
                    'Extract Pattern'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview & Edit */}
          {step === 'preview' && extractionResult && editedPatternData && (
            <div className="step-content preview-step">
              <div className="preview-header">
                <h3>Extracted Pattern Details</h3>
                <p className="source-info">
                  From: <a href={extractionResult.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {extractionResult.extracted.siteName || new URL(extractionResult.sourceUrl).hostname}
                  </a>
                </p>
              </div>

              <div className="edit-form">
                <div className="form-group">
                  <label>Pattern Name *</label>
                  <input
                    type="text"
                    value={editedPatternData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Pattern name"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Designer</label>
                    <input
                      type="text"
                      value={editedPatternData.designer || ''}
                      onChange={(e) => handleFieldChange('designer', e.target.value || null)}
                      placeholder="Designer name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={editedPatternData.category || ''}
                      onChange={(e) => handleFieldChange('category', e.target.value || null)}
                    >
                      <option value="">Select category</option>
                      <option value="sweater">Sweater</option>
                      <option value="cardigan">Cardigan</option>
                      <option value="scarf">Scarf</option>
                      <option value="hat">Hat</option>
                      <option value="socks">Socks</option>
                      <option value="mittens">Mittens</option>
                      <option value="blanket">Blanket</option>
                      <option value="shawl">Shawl</option>
                      <option value="bag">Bag</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Difficulty</label>
                    <select
                      value={editedPatternData.difficulty || ''}
                      onChange={(e) => handleFieldChange('difficulty', e.target.value || null)}
                    >
                      <option value="">Select difficulty</option>
                      <option value="beginner">Beginner</option>
                      <option value="easy">Easy</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Estimated Yardage</label>
                    <input
                      type="number"
                      value={editedPatternData.estimatedYardage || ''}
                      onChange={(e) =>
                        handleFieldChange('estimatedYardage', e.target.value ? parseInt(e.target.value, 10) : null)
                      }
                      placeholder="e.g., 400"
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={editedPatternData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Pattern description"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Notes (Extracted Content)</label>
                  <textarea
                    value={editedPatternData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    placeholder="Pattern notes and instructions"
                    rows={6}
                  />
                </div>

                {/* Yarn Requirements Summary */}
                {editedPatternData.yarnRequirements.length > 0 && (
                  <div className="extracted-info">
                    <h4>Detected Yarn Requirements</h4>
                    <ul>
                      {editedPatternData.yarnRequirements.map((yarn, index) => (
                        <li key={index}>
                          {yarn.weight && <span className="tag">{yarn.weight}</span>}
                          {yarn.yardage && <span>{yarn.yardage} yards</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Needle Sizes Summary */}
                {editedPatternData.needleSizes.length > 0 && (
                  <div className="extracted-info">
                    <h4>Detected Needle Sizes</h4>
                    <ul>
                      {editedPatternData.needleSizes.map((needle, index) => (
                        <li key={index}>
                          {needle.us && <span>US {needle.us}</span>}
                          {needle.mm && <span> ({needle.mm}mm)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gauge Summary */}
                {editedPatternData.gauge && (
                  <div className="extracted-info">
                    <h4>Detected Gauge</h4>
                    <p>
                      {editedPatternData.gauge.stitches} stitches
                      {editedPatternData.gauge.rows && ` x ${editedPatternData.gauge.rows} rows`}
                      {' '}= {editedPatternData.gauge.measurement}
                    </p>
                  </div>
                )}
              </div>

              <div className="step-actions">
                <button className="btn-secondary" onClick={() => setStep('url')}>
                  <FiArrowLeft /> Back
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSavePattern}
                  disabled={loading || !editedPatternData.name.trim()}
                >
                  {loading ? (
                    <>
                      <FiLoader className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <FiSave /> Save Pattern
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="step-content success-step">
              <div className="success-icon">
                <FiCheck />
              </div>
              <h3>Pattern Imported Successfully!</h3>
              <p>Your pattern has been saved to your library.</p>
              <div className="step-actions">
                <button className="btn-secondary" onClick={handleReset}>
                  Import Another
                </button>
                <button className="btn-primary" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{`
          .blog-import-overlay {
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

          .blog-import-modal {
            background: white;
            border-radius: 12px;
            max-width: 700px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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
            transition: all 0.2s;
          }

          .close-btn:hover {
            background-color: #f3f4f6;
            color: #374151;
          }

          .progress-steps {
            display: flex;
            justify-content: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            gap: 8px;
          }

          .step {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 20px;
            background-color: #f3f4f6;
            color: #6b7280;
            font-size: 14px;
          }

          .step.active {
            background-color: #3b82f6;
            color: white;
          }

          .step.completed {
            background-color: #10b981;
            color: white;
          }

          .step-number {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
          }

          .step.active .step-number,
          .step.completed .step-number {
            background-color: rgba(255, 255, 255, 0.3);
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
          }

          .step-content {
            animation: fadeIn 0.2s ease;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .step-description {
            color: #6b7280;
            margin-bottom: 20px;
            line-height: 1.6;
          }

          .url-input-group {
            display: flex;
            align-items: center;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            gap: 12px;
            transition: border-color 0.2s;
          }

          .url-input-group:focus-within {
            border-color: #3b82f6;
          }

          .input-icon {
            color: #9ca3af;
            flex-shrink: 0;
          }

          .url-input-group input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 16px;
          }

          .help-text {
            font-size: 13px;
            color: #9ca3af;
            margin-top: 12px;
          }

          .step-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
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

          /* Preview Step Styles */
          .preview-header {
            margin-bottom: 20px;
          }

          .preview-header h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .source-info {
            font-size: 13px;
            color: #6b7280;
          }

          .source-info a {
            color: #3b82f6;
            text-decoration: none;
          }

          .source-info a:hover {
            text-decoration: underline;
          }

          .edit-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
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

          .form-group input,
          .form-group select,
          .form-group textarea {
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s;
          }

          .form-group input:focus,
          .form-group select:focus,
          .form-group textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .form-group textarea {
            resize: vertical;
            min-height: 80px;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .extracted-info {
            padding: 12px 16px;
            background-color: #f0f9ff;
            border-radius: 8px;
            border: 1px solid #bae6fd;
          }

          .extracted-info h4 {
            font-size: 13px;
            font-weight: 600;
            color: #0369a1;
            margin-bottom: 8px;
          }

          .extracted-info ul {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .extracted-info li {
            font-size: 13px;
            color: #0369a1;
          }

          .extracted-info p {
            font-size: 13px;
            color: #0369a1;
            margin: 0;
          }

          .tag {
            display: inline-block;
            padding: 2px 8px;
            background-color: #dbeafe;
            border-radius: 4px;
            font-weight: 500;
            text-transform: capitalize;
          }

          /* Success Step Styles */
          .success-step {
            text-align: center;
            padding: 40px 0;
          }

          .success-icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background-color: #10b981;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 20px;
          }

          .success-step h3 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #059669;
          }

          .success-step p {
            color: #6b7280;
            margin-bottom: 0;
          }

          .success-step .step-actions {
            justify-content: center;
          }

          @media (max-width: 600px) {
            .blog-import-modal {
              max-height: 100vh;
              border-radius: 0;
            }

            .progress-steps {
              flex-direction: column;
              align-items: center;
            }

            .step-label {
              display: none;
            }

            .form-row {
              grid-template-columns: 1fr;
            }

            .step-actions {
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

export default BlogImportModal;
