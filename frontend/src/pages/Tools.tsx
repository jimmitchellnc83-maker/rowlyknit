import { useState, useCallback, useMemo } from 'react';
import { FiPlus, FiTrash2, FiTool, FiEdit2, FiSearch, FiChevronRight } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useEscapeKey } from '../hooks/useEscapeKey';
import ConfirmModal from '../components/ConfirmModal';
import ToolTypeAutocomplete from '../components/ToolTypeAutocomplete';
import { useTools as useToolsQuery, useCreateTool, useUpdateTool, useDeleteTool } from '../hooks/useApi';
import { useToolTaxonomyTree } from '../hooks/useToolTaxonomy';
import type { ToolTaxonomySuggestion, TaxonomyToolType } from '../types/toolTaxonomy';
import { getSizePresetsForType, getSizeOptions, getSizeLabel } from '../data/toolSizes';
import { useMeasurementPrefs } from '../hooks/useMeasurementPrefs';

interface Tool {
  id: string;
  name: string;
  type: string;
  category: string;
  size: string;
  size_mm: number | null;
  material: string;
  brand: string;
  quantity: number;
  taxonomy_type_id?: string;
  taxonomy_label?: string;
  taxonomy_category_label?: string;
  taxonomy_subcategory_label?: string;
}

interface FormData {
  name: string;
  category: string;
  type: string;
  specificKind: string;
  taxonomyTypeId: string;
  taxonomyLabel: string;
  taxonomyCategoryLabel: string;
  taxonomySubcategoryLabel: string;
  size: string;
  sizeMm: string;  // stored as string for form, sent as number to API
  material: string;
  brand: string;
  quantity: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  category: '',
  type: '',
  specificKind: '',
  taxonomyTypeId: '',
  taxonomyLabel: '',
  taxonomyCategoryLabel: '',
  taxonomySubcategoryLabel: '',
  size: '',
  sizeMm: '',
  material: '',
  brand: '',
  quantity: '1',
};

export default function Tools() {
  const { data: tools = [], isLoading: loading } = useToolsQuery() as { data: Tool[] | undefined; isLoading: boolean };
  const { data: taxonomyTree = [] } = useToolTaxonomyTree();
  const { prefs, fmt } = useMeasurementPrefs();
  const createTool = useCreateTool();
  const updateToolMutation = useUpdateTool();
  const deleteToolMutation = useDeleteTool();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [showSearch, setShowSearch] = useState(false);

  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingTool(null);
    setShowSearch(false);
  }, []);

  useEscapeKey(closeAllModals, showCreateModal || showEditModal);

  // Derive tool types for the selected category
  const toolTypesForCategory = useMemo(() => {
    if (!formData.category || taxonomyTree.length === 0) return [];
    const cat = taxonomyTree.find((c) => c.id === formData.category);
    if (!cat) return [];
    const types: TaxonomyToolType[] = [];
    for (const sub of cat.subcategories) {
      for (const tt of sub.toolTypes) {
        types.push(tt);
      }
    }
    return types;
  }, [formData.category, taxonomyTree]);

  // Find current tool type metadata
  const selectedToolType = useMemo(() => {
    return toolTypesForCategory.find((tt) => tt.id === formData.type);
  }, [formData.type, toolTypesForCategory]);

  const handleCategoryChange = (categoryId: string) => {
    const cat = taxonomyTree.find((c) => c.id === categoryId);
    const firstType = cat?.subcategories[0]?.toolTypes[0];
    setFormData({
      ...formData,
      category: categoryId,
      taxonomyCategoryLabel: cat?.label || '',
      type: firstType?.id || '',
      taxonomyTypeId: firstType?.id || '',
      taxonomyLabel: firstType?.label || '',
      taxonomySubcategoryLabel: cat?.subcategories[0]?.label || '',
    });
  };

  const handleTypeChange = (typeId: string) => {
    const cat = taxonomyTree.find((c) => c.id === formData.category);
    if (!cat) return;
    for (const sub of cat.subcategories) {
      const tt = sub.toolTypes.find((t) => t.id === typeId);
      if (tt) {
        setFormData({
          ...formData,
          type: typeId,
          specificKind: '',
          taxonomyTypeId: typeId,
          taxonomyLabel: tt.label,
          taxonomySubcategoryLabel: sub.label,
        });
        return;
      }
    }
  };

  const handleAutocompleteSelect = (suggestion: ToolTaxonomySuggestion) => {
    setFormData({
      ...formData,
      category: suggestion.categoryId,
      type: suggestion.toolTypeId,
      specificKind: '',
      taxonomyTypeId: suggestion.toolTypeId,
      taxonomyLabel: suggestion.label,
      taxonomyCategoryLabel: suggestion.categoryLabel,
      taxonomySubcategoryLabel: suggestion.subcategoryLabel,
    });
    setShowSearch(false);
  };

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter a tool name');
      return;
    }
    if (!formData.type) {
      toast.error('Please select a tool type');
      return;
    }
    createTool.mutate(formData, {
      onSuccess: () => {
        toast.success('Tool added successfully!');
        setShowCreateModal(false);
        setFormData({ ...EMPTY_FORM });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to add tool');
      },
    });
  };

  const handleEditClick = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name || '',
      category: tool.category || '',
      type: tool.type || tool.taxonomy_type_id || '',
      specificKind: '',
      taxonomyTypeId: tool.taxonomy_type_id || tool.type || '',
      taxonomyLabel: tool.taxonomy_label || '',
      taxonomyCategoryLabel: tool.taxonomy_category_label || '',
      taxonomySubcategoryLabel: tool.taxonomy_subcategory_label || '',
      size: tool.size || '',
      sizeMm: tool.size_mm?.toString() || '',
      material: tool.material || '',
      brand: tool.brand || '',
      quantity: tool.quantity?.toString() || '1',
    });
    setShowEditModal(true);
  };

  const handleUpdateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTool) return;
    updateToolMutation.mutate({ id: editingTool.id, formData }, {
      onSuccess: () => {
        toast.success('Tool updated successfully!');
        setShowEditModal(false);
        setEditingTool(null);
        setFormData({ ...EMPTY_FORM });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update tool');
      },
    });
  };

  const handleDeleteTool = async (id: string, _name: string) => {
    deleteToolMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Tool deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete tool');
      },
      onSettled: () => {
        setDeleteTarget(null);
      },
    });
  };

  // Category filter counts from user's tools
  const categoryCounts = new Map<string, { label: string; count: number }>();
  for (const t of tools) {
    const key = t.category || 'other';
    const existing = categoryCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      categoryCounts.set(key, {
        label: t.taxonomy_category_label || t.category || 'Other',
        count: 1,
      });
    }
  }

  const filteredTools = filterCategory === 'all'
    ? tools
    : tools.filter((t) => (t.category || 'other') === filterCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading tools...</div>
      </div>
    );
  }

  // Size presets based on selected tool type + user preferences
  const sizePresets = formData.type ? getSizePresetsForType(formData.type) : { primary: 'none' as const };
  const primarySizeOptions = getSizeOptions(sizePresets.primary, prefs.needleSizeFormat, prefs.lengthDisplayUnit as 'in' | 'cm');
  const primarySizeLabel = getSizeLabel(sizePresets.primary, prefs.needleSizeFormat, prefs.lengthDisplayUnit as 'in' | 'cm');

  // Step indicator helper
  const stepDone = (n: number) => {
    if (n === 1) return !!formData.category;
    if (n === 2) return !!formData.type;
    if (n === 3) return !!formData.name;
    return false;
  };

  const StepBadge = ({ n, label }: { n: number; label: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
        stepDone(n) ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
      }`}>{n}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );

  const toolForm = (
    <>
      {/* Breadcrumb of selections so far */}
      {(formData.taxonomyCategoryLabel || formData.taxonomyLabel || formData.specificKind) && (
        <div className="flex items-center gap-1 text-sm bg-purple-50 rounded-lg px-3 py-2 flex-wrap">
          {formData.taxonomyCategoryLabel && (
            <span className="text-purple-700 font-medium">{formData.taxonomyCategoryLabel}</span>
          )}
          {formData.taxonomyLabel && (
            <>
              <FiChevronRight className="text-purple-400 h-3 w-3 flex-shrink-0" />
              <span className="text-purple-700 font-medium">{formData.taxonomyLabel}</span>
            </>
          )}
          {formData.specificKind && (
            <>
              <FiChevronRight className="text-purple-400 h-3 w-3 flex-shrink-0" />
              <span className="text-purple-900 font-semibold">{formData.specificKind}</span>
            </>
          )}
        </div>
      )}

      {/* Quick search toggle */}
      {showSearch ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Search for a tool type</span>
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              Browse by category instead
            </button>
          </div>
          <ToolTypeAutocomplete
            onSelect={handleAutocompleteSelect}
            initialLabel=""
          />
          <p className="text-xs text-gray-400 mt-1">Type a tool name, synonym, or keyword to find it quickly</p>
        </div>
      ) : (
        <>
          {/* Step 1: Category */}
          <div>
            <div className="flex items-center justify-between">
              <StepBadge n={1} label="What kind of tool is it?" />
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <FiSearch className="h-3 w-3" />
                Search instead
              </button>
            </div>
            <select
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              <option value="">Choose a category...</option>
              {taxonomyTree.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Tool Type — appears after category */}
          {formData.category && (
            <div>
              <StepBadge n={2} label="What type of tool?" />
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="">Choose a tool type...</option>
                {taxonomyTree
                  .find((c) => c.id === formData.category)
                  ?.subcategories.map((sub) => (
                    <optgroup key={sub.id} label={sub.label}>
                      {sub.toolTypes.map((tt) => (
                        <option key={tt.id} value={tt.id}>{tt.label}</option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </div>
          )}

          {/* Step 2b: Specific kind — appears if the type has keyword variants */}
          {selectedToolType && selectedToolType.keywords.length > 0 && (
            <div className="ml-8 border-l-2 border-purple-200 pl-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Narrow it down (optional)
              </label>
              <select
                value={formData.specificKind}
                onChange={(e) => setFormData({ ...formData, specificKind: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Any / General</option>
                {selectedToolType.keywords.map((kw) => (
                  <option key={kw} value={kw}>{kw.charAt(0).toUpperCase() + kw.slice(1)}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* Step 3: Tool Name — always visible */}
      <div>
        <StepBadge n={3} label="Name your tool" />
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder={formData.specificKind
            ? `e.g., My ${formData.specificKind}`
            : selectedToolType
            ? `e.g., My ${selectedToolType.label}`
            : 'e.g., ChiaoGoo 32" Circular Needles'}
          required
        />
        <p className="text-xs text-gray-400 mt-1">Your name for this specific tool — brand, size, color, whatever helps you identify it</p>
      </div>

      {/* Details section */}
      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Details (optional)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Size — smart dropdown or free text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{primarySizeLabel}</label>
            {primarySizeOptions.length > 0 ? (
              <select
                value={formData.sizeMm}
                onChange={(e) => setFormData({ ...formData, sizeMm: e.target.value, size: e.target.options[e.target.selectedIndex]?.text || '' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select size...</option>
                {primarySizeOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
                <option value="custom">Other (type custom)</option>
              </select>
            ) : (
              <input
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., US 7, 4.5mm"
              />
            )}
            {formData.size === 'custom' && (
              <input
                type="text"
                value=""
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Type your custom size..."
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Material</label>
            <input
              type="text"
              value={formData.material}
              onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Bamboo, Metal, Wood"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., ChiaoGoo, Addi, Clover"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="1"
            />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tools</h1>
          <p className="text-gray-600 mt-1">Manage your knitting and crochet tools</p>
        </div>
        <button
          onClick={() => {
            setFormData({ ...EMPTY_FORM });
            setShowSearch(false);
            setShowCreateModal(true);
          }}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiPlus className="mr-2" />
          Add Tool
        </button>
      </div>

      {/* Category filter pills */}
      {tools.length > 0 && categoryCounts.size > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({tools.length})
          </button>
          {[...categoryCounts.entries()].map(([key, { label, count }]) => (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                filterCategory === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {tools.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiTool className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tools yet</h3>
          <p className="text-gray-500 mb-4">Start tracking your knitting and crochet tools</p>
          <button
            onClick={() => {
              setFormData({ ...EMPTY_FORM });
              setShowSearch(false);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Tool
          </button>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiTool className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tools in this category</h3>
          <button
            onClick={() => setFilterCategory('all')}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            Show all tools
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <div key={tool.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 flex-1 mr-2">{tool.name}</h3>
                {(tool.taxonomy_category_label || tool.category) && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap bg-purple-100 text-purple-800">
                    {tool.taxonomy_category_label || tool.category}
                  </span>
                )}
              </div>
              <div className="text-sm text-purple-600 font-medium mb-3">
                {tool.taxonomy_label || tool.type}
                {tool.size_mm
                  ? <span className="text-gray-500"> &middot; {fmt.needleSize(tool.size_mm)}</span>
                  : tool.size && <span className="text-gray-500"> &middot; {tool.size}</span>
                }
              </div>
              {tool.taxonomy_subcategory_label && (
                <div className="text-xs text-gray-400 mb-2">{tool.taxonomy_subcategory_label}</div>
              )}
              <div className="space-y-1 mb-4">
                {tool.brand && (
                  <div className="text-sm text-gray-500"><span className="font-medium">Brand:</span> {tool.brand}</div>
                )}
                {tool.material && (
                  <div className="text-sm text-gray-500"><span className="font-medium">Material:</span> {tool.material}</div>
                )}
                {tool.quantity > 1 && (
                  <div className="text-sm text-gray-500"><span className="font-medium">Qty:</span> {tool.quantity}</div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleEditClick(tool)}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                >
                  <FiEdit2 className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: tool.id, name: tool.name })}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center justify-center text-sm"
                >
                  <FiTrash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Tool Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Tool</h2>
            </div>
            <form onSubmit={handleCreateTool} className="p-6 space-y-4">
              {toolForm}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">Add Tool</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tool Modal */}
      {showEditModal && editingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Tool</h2>
            </div>
            <form onSubmit={handleUpdateTool} className="p-6 space-y-4">
              {toolForm}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingTool(null); setFormData({ ...EMPTY_FORM }); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">Update Tool</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Tool"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteTool(deleteTarget.id, deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
