import React, { useState } from 'react';
import { FiFileText, FiTrash2, FiDownload } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

type TemplateType = 'gauge_swatch' | 'fit_adjustment' | 'yarn_substitution' | 'finishing_techniques';

interface GaugeSwatchData {
  needle_size: string;
  stitches_per_inch: number;
  rows_per_inch: number;
  swatch_width: number;
  swatch_height: number;
  notes?: string;
}

interface FitAdjustmentData {
  measurement_name: string;
  original_value: number;
  adjusted_value: number;
  reason: string;
  notes?: string;
}

interface YarnSubstitutionData {
  original_yarn_name: string;
  original_yarn_weight: string;
  original_yardage: number;
  replacement_yarn_name: string;
  replacement_yarn_weight: string;
  replacement_yardage: number;
  gauge_comparison: string;
  notes?: string;
}

interface FinishingTechniquesData {
  bind_off_method: string;
  seaming_technique: string;
  blocking_instructions: string;
  notes?: string;
}

type MemoData = GaugeSwatchData | FitAdjustmentData | YarnSubstitutionData | FinishingTechniquesData;

interface StructuredMemo {
  id: string;
  project_id: string;
  template_type: TemplateType;
  data: MemoData;
  created_at: string;
}

interface StructuredMemoTemplatesProps {
  projectId: string;
  memos: StructuredMemo[];
  onSaveMemo: (templateType: TemplateType, data: MemoData) => Promise<void>;
  onDeleteMemo: (memoId: string) => Promise<void>;
}

const TEMPLATE_INFO = {
  gauge_swatch: {
    name: 'Gauge Swatch',
    icon: '📏',
    description: 'Record gauge measurements for accurate sizing',
  },
  fit_adjustment: {
    name: 'Fit Adjustment',
    icon: '📐',
    description: 'Track modifications to pattern measurements',
  },
  yarn_substitution: {
    name: 'Yarn Substitution',
    icon: '🧶',
    description: 'Document yarn changes and gauge comparison',
  },
  finishing_techniques: {
    name: 'Finishing Techniques',
    icon: '✨',
    description: 'Notes on bind-off, seaming, and blocking',
  },
};

export const StructuredMemoTemplates: React.FC<StructuredMemoTemplatesProps> = ({
  projectId: _projectId,
  memos,
  onSaveMemo,
  onDeleteMemo,
}) => {
  const [showNewMemoModal, setShowNewMemoModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('gauge_swatch');
  const [formData, setFormData] = useState<any>({});

  const handleOpenNewMemo = (templateType: TemplateType) => {
    setSelectedTemplate(templateType);
    setFormData({});
    setShowNewMemoModal(true);
  };

  const handleSaveMemo = async () => {
    try {
      await onSaveMemo(selectedTemplate, formData);
      setShowNewMemoModal(false);
      setFormData({});
    } catch (error) {
      console.error('Failed to save memo:', error);
      alert('Failed to save memo');
    }
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!confirm('Are you sure you want to delete this memo?')) return;

    try {
      await onDeleteMemo(memoId);
    } catch (error) {
      console.error('Failed to delete memo:', error);
      alert('Failed to delete memo');
    }
  };

  const exportMemo = (memo: StructuredMemo) => {
    const text = renderMemoAsText(memo);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${TEMPLATE_INFO[memo.template_type].name.replace(/\s/g, '_')}_${memo.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMemoAsText = (memo: StructuredMemo): string => {
    const title = TEMPLATE_INFO[memo.template_type].name;
    const date = new Date(memo.created_at).toLocaleDateString();

    let content = `${title}\n`;
    content += `Date: ${date}\n`;
    content += `${'='.repeat(50)}\n\n`;

    switch (memo.template_type) {
      case 'gauge_swatch':
        const gauge = memo.data as GaugeSwatchData;
        content += `Needle Size: ${gauge.needle_size}\n`;
        content += `Stitches per Inch: ${gauge.stitches_per_inch}\n`;
        content += `Rows per Inch: ${gauge.rows_per_inch}\n`;
        content += `Swatch Dimensions: ${gauge.swatch_width}" × ${gauge.swatch_height}"\n`;
        if (gauge.notes) content += `\nNotes: ${gauge.notes}\n`;
        break;

      case 'fit_adjustment':
        const fit = memo.data as FitAdjustmentData;
        content += `Measurement: ${fit.measurement_name}\n`;
        content += `Original: ${fit.original_value}\n`;
        content += `Adjusted: ${fit.adjusted_value}\n`;
        content += `Reason: ${fit.reason}\n`;
        if (fit.notes) content += `\nNotes: ${fit.notes}\n`;
        break;

      case 'yarn_substitution':
        const yarn = memo.data as YarnSubstitutionData;
        content += `Original Yarn: ${yarn.original_yarn_name} (${yarn.original_yarn_weight})\n`;
        content += `Original Yardage: ${yarn.original_yardage} yards\n`;
        content += `Replacement Yarn: ${yarn.replacement_yarn_name} (${yarn.replacement_yarn_weight})\n`;
        content += `Replacement Yardage: ${yarn.replacement_yardage} yards\n`;
        content += `Gauge Comparison: ${yarn.gauge_comparison}\n`;
        if (yarn.notes) content += `\nNotes: ${yarn.notes}\n`;
        break;

      case 'finishing_techniques':
        const finish = memo.data as FinishingTechniquesData;
        content += `Bind-Off Method: ${finish.bind_off_method}\n`;
        content += `Seaming Technique: ${finish.seaming_technique}\n`;
        content += `Blocking Instructions: ${finish.blocking_instructions}\n`;
        if (finish.notes) content += `\nNotes: ${finish.notes}\n`;
        break;
    }

    return content;
  };

  const renderTemplateForm = () => {
    switch (selectedTemplate) {
      case 'gauge_swatch':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Needle Size
              </label>
              <input
                type="text"
                value={formData.needle_size || ''}
                onChange={(e) => setFormData({ ...formData, needle_size: e.target.value })}
                placeholder="e.g., US 7 / 4.5mm"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stitches per Inch
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.stitches_per_inch || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, stitches_per_inch: parseFloat(e.target.value) })
                  }
                  placeholder="4.5"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rows per Inch
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.rows_per_inch || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, rows_per_inch: parseFloat(e.target.value) })
                  }
                  placeholder="6.0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Swatch Width (inches)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.swatch_width || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, swatch_width: parseFloat(e.target.value) })
                  }
                  placeholder="4"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Swatch Height (inches)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.swatch_height || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, swatch_height: parseFloat(e.target.value) })
                  }
                  placeholder="4"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional observations..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
              />
            </div>
          </div>
        );

      case 'fit_adjustment':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Measurement Name
              </label>
              <input
                type="text"
                value={formData.measurement_name || ''}
                onChange={(e) => setFormData({ ...formData, measurement_name: e.target.value })}
                placeholder="e.g., Sleeve length, Bust circumference"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Original Value
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.original_value || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, original_value: parseFloat(e.target.value) })
                  }
                  placeholder="36"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adjusted Value
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.adjusted_value || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, adjusted_value: parseFloat(e.target.value) })
                  }
                  placeholder="38"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Change
              </label>
              <input
                type="text"
                value={formData.reason || ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Prefer looser fit, Accommodate larger bust"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={2}
              />
            </div>
          </div>
        );

      case 'yarn_substitution':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Original Yarn Name
                </label>
                <input
                  type="text"
                  value={formData.original_yarn_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, original_yarn_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Original Weight
                </label>
                <input
                  type="text"
                  value={formData.original_yarn_weight || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, original_yarn_weight: e.target.value })
                  }
                  placeholder="DK, Worsted, etc."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Original Yardage
              </label>
              <input
                type="number"
                value={formData.original_yardage || ''}
                onChange={(e) =>
                  setFormData({ ...formData, original_yardage: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Replacement Yarn Name
                </label>
                <input
                  type="text"
                  value={formData.replacement_yarn_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, replacement_yarn_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Replacement Weight
                </label>
                <input
                  type="text"
                  value={formData.replacement_yarn_weight || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, replacement_yarn_weight: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Replacement Yardage
              </label>
              <input
                type="number"
                value={formData.replacement_yardage || ''}
                onChange={(e) =>
                  setFormData({ ...formData, replacement_yardage: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gauge Comparison
              </label>
              <input
                type="text"
                value={formData.gauge_comparison || ''}
                onChange={(e) =>
                  setFormData({ ...formData, gauge_comparison: e.target.value })
                }
                placeholder="e.g., Same gauge, Slightly looser"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Differences in texture, drape, etc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={2}
              />
            </div>
          </div>
        );

      case 'finishing_techniques':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bind-Off Method
              </label>
              <input
                type="text"
                value={formData.bind_off_method || ''}
                onChange={(e) => setFormData({ ...formData, bind_off_method: e.target.value })}
                placeholder="e.g., Standard, Sewn, I-cord"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Seaming Technique
              </label>
              <input
                type="text"
                value={formData.seaming_technique || ''}
                onChange={(e) => setFormData({ ...formData, seaming_technique: e.target.value })}
                placeholder="e.g., Mattress stitch, Kitchener stitch"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Blocking Instructions
              </label>
              <textarea
                value={formData.blocking_instructions || ''}
                onChange={(e) =>
                  setFormData({ ...formData, blocking_instructions: e.target.value })
                }
                placeholder="Wet blocking, steam blocking, measurements, etc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Notes (optional)
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any other finishing details..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={2}
              />
            </div>
          </div>
        );
    }
  };

  const renderMemoCard = (memo: StructuredMemo) => {
    const info = TEMPLATE_INFO[memo.template_type];

    return (
      <div
        key={memo.id}
        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{info.icon}</span>
              <h4 className="font-medium text-gray-900 dark:text-white">{info.name}</h4>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(memo.created_at), { addSuffix: true })}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportMemo(memo)}
              className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              title="Export"
            >
              <FiDownload className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteMemo(memo.id)}
              className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
              title="Delete"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded">
          <pre className="whitespace-pre-wrap font-sans">{renderMemoAsText(memo)}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FiFileText className="w-5 h-5" />
          Structured Memos
        </h3>
      </div>

      {/* Template Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {(Object.entries(TEMPLATE_INFO) as [TemplateType, typeof TEMPLATE_INFO[TemplateType]][]).map(
          ([type, info]) => (
            <button
              key={type}
              onClick={() => handleOpenNewMemo(type)}
              className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left"
            >
              <span className="text-3xl">{info.icon}</span>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{info.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {info.description}
                </div>
              </div>
            </button>
          )
        )}
      </div>

      {/* Saved Memos */}
      <div className="space-y-3">
        {memos.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FiFileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No memos yet</p>
            <p className="text-sm mt-1">Click a template above to create your first memo</p>
          </div>
        ) : (
          memos.map(renderMemoCard)
        )}
      </div>

      {/* New Memo Modal */}
      {showNewMemoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{TEMPLATE_INFO[selectedTemplate].icon}</span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {TEMPLATE_INFO[selectedTemplate].name}
              </h3>
            </div>

            {renderTemplateForm()}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewMemoModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMemo}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Save Memo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
