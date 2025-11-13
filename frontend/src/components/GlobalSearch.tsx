import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface SearchResult {
  id: string;
  type: 'project' | 'pattern' | 'yarn' | 'recipient' | 'tool';
  title: string;
  subtitle?: string;
  url: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search debounced
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      await performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const [projects, patterns, yarn, recipients, tools] = await Promise.all([
        axios.get(`/api/projects?search=${encodeURIComponent(searchQuery)}`).catch(() => ({ data: { data: { projects: [] } } })),
        axios.get(`/api/patterns?search=${encodeURIComponent(searchQuery)}`).catch(() => ({ data: { data: { patterns: [] } } })),
        axios.get(`/api/yarn?search=${encodeURIComponent(searchQuery)}`).catch(() => ({ data: { data: { yarn: [] } } })),
        axios.get(`/api/recipients?search=${encodeURIComponent(searchQuery)}`).catch(() => ({ data: { data: { recipients: [] } } })),
        axios.get(`/api/tools?search=${encodeURIComponent(searchQuery)}`).catch(() => ({ data: { data: { tools: [] } } })),
      ]);

      const searchResults: SearchResult[] = [];

      // Projects
      projects.data.data.projects?.slice(0, 5).forEach((p: any) => {
        searchResults.push({
          id: p.id,
          type: 'project',
          title: p.name,
          subtitle: p.description || p.status,
          url: `/projects/${p.id}`,
        });
      });

      // Patterns
      patterns.data.data.patterns?.slice(0, 3).forEach((p: any) => {
        searchResults.push({
          id: p.id,
          type: 'pattern',
          title: p.name,
          subtitle: p.designer || p.pattern_type,
          url: '/patterns',
        });
      });

      // Yarn
      yarn.data.data.yarn?.slice(0, 3).forEach((y: any) => {
        searchResults.push({
          id: y.id,
          type: 'yarn',
          title: `${y.brand} ${y.name}`,
          subtitle: `${y.color_name || ''} - ${y.weight || ''}`,
          url: '/yarn',
        });
      });

      // Recipients
      recipients.data.data.recipients?.slice(0, 2).forEach((r: any) => {
        searchResults.push({
          id: r.id,
          type: 'recipient',
          title: r.name,
          subtitle: r.relationship,
          url: '/recipients',
        });
      });

      // Tools
      tools.data.data.tools?.slice(0, 2).forEach((t: any) => {
        searchResults.push({
          id: t.id,
          type: 'tool',
          title: t.name,
          subtitle: t.tool_type,
          url: '/tools',
        });
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    setIsOpen(false);
    setQuery('');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'project': return 'bg-purple-100 text-purple-800';
      case 'pattern': return 'bg-blue-100 text-blue-800';
      case 'yarn': return 'bg-pink-100 text-pink-800';
      case 'recipient': return 'bg-green-100 text-green-800';
      case 'tool': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        aria-label="Open global search"
        title="Search (⌘K)"
      >
        <FiSearch className="h-4 w-4" />
        <span>Search</span>
        <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold text-gray-500 bg-gray-200 border border-gray-300 rounded">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsOpen(false);
          setQuery('');
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[60vh] flex flex-col">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FiSearch className="h-5 w-5 text-gray-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, patterns, yarn, and more..."
              className="flex-1 outline-none text-lg bg-transparent text-gray-900 dark:text-gray-100"
              aria-label="Search input"
              autoComplete="off"
            />
            <button
              onClick={() => {
                setIsOpen(false);
                setQuery('');
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close search"
            >
              <FiX className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div
          className="flex-1 overflow-y-auto p-2"
          role="region"
          aria-live="polite"
          aria-label="Search results"
        >
          {loading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400" role="status">
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400" role="status">
              No results found
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-1" role="list">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition flex items-center justify-between"
                  role="listitem"
                  aria-label={`${result.type}: ${result.title}${result.subtitle ? ` - ${result.subtitle}` : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">{result.subtitle}</div>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(result.type)}`}>
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p className="mb-2">Start typing to search</p>
              <p className="text-sm">Projects, patterns, yarn, recipients, and tools</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>Press ESC to close</span>
          <span>⌘K to open</span>
        </div>
      </div>
    </div>
  );
}
