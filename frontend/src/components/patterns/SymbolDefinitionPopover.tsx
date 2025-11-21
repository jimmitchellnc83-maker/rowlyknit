// @ts-nocheck
import React, { useRef, useEffect } from 'react';
import { FiX, FiExternalLink, FiBookOpen } from 'react-icons/fi';
import type { KnittingSymbol } from '../../data/knittingSymbols';
import { SYMBOL_CATEGORIES } from '../../data/knittingSymbols';

interface SymbolDefinitionPopoverProps {
  symbol: KnittingSymbol;
  position: { x: number; y: number };
  instanceCount: number;
  onClose: () => void;
  onViewVideo?: (url: string) => void;
}

export default function SymbolDefinitionPopover({
  symbol,
  position,
  instanceCount,
  onClose,
  onViewVideo,
}: SymbolDefinitionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay adding listener to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = { ...position };
  if (popoverRef.current) {
    const rect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (position.x + rect.width > viewportWidth - 20) {
      adjustedPosition.x = position.x - rect.width - 20;
    }
    if (position.y + rect.height > viewportHeight - 20) {
      adjustedPosition.y = position.y - rect.height - 20;
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'basic':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'decrease':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'increase':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'cable':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
      case 'twisted':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'special':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'colorwork':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div
      ref={popoverRef}
      className="symbol-popover fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 overflow-hidden"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        maxHeight: '80vh',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: symbol.color || '#6B7280' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-white drop-shadow-lg">
            {symbol.symbol}
          </span>
          <div>
            <h3 className="font-bold text-white text-lg drop-shadow">{symbol.name}</h3>
            <span className="text-white/80 text-sm font-mono">{symbol.abbreviation}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition"
          aria-label="Close"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-96">
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(symbol.category)}`}>
            {SYMBOL_CATEGORIES[symbol.category]}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(symbol.difficulty)}`}>
            {symbol.difficulty.charAt(0).toUpperCase() + symbol.difficulty.slice(1)}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            {instanceCount} {instanceCount === 1 ? 'instance' : 'instances'} highlighted
          </span>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Description</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">{symbol.description}</p>
        </div>

        {/* Instructions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
            <FiBookOpen className="h-4 w-4" />
            How to Work
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">{symbol.instructions}</p>
        </div>

        {/* RS/WS Instructions */}
        {(symbol.rsInstruction || symbol.wsInstruction) && (
          <div className="grid grid-cols-2 gap-3">
            {symbol.rsInstruction && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Right Side (RS)</h5>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{symbol.rsInstruction}</p>
              </div>
            )}
            {symbol.wsInstruction && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Wrong Side (WS)</h5>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{symbol.wsInstruction}</p>
              </div>
            )}
          </div>
        )}

        {/* Video Link */}
        {symbol.videoUrl && onViewVideo && (
          <button
            onClick={() => onViewVideo(symbol.videoUrl!)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-medium"
          >
            <FiExternalLink className="h-4 w-4" />
            Watch Tutorial Video
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Tap anywhere on the chart to dismiss
        </p>
      </div>
    </div>
  );
}
