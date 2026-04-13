import { useState, useRef, useEffect } from 'react';
import { FiHelpCircle } from 'react-icons/fi';

interface HelpTooltipProps {
  text: string;
  size?: 'sm' | 'md';
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function HelpTooltip({ text, size = 'sm', position = 'top' }: HelpTooltipProps) {
  const [show, setShow] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Adjust position if tooltip would go off-screen
  useEffect(() => {
    if (show && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const trigger = triggerRef.current.getBoundingClientRect();

      if (position === 'top' && trigger.top - tooltip.height < 8) {
        setAdjustedPosition('bottom');
      } else if (position === 'bottom' && trigger.bottom + tooltip.height > window.innerHeight - 8) {
        setAdjustedPosition('top');
      } else if (position === 'right' && trigger.right + tooltip.width > window.innerWidth - 8) {
        setAdjustedPosition('left');
      } else if (position === 'left' && trigger.left - tooltip.width < 8) {
        setAdjustedPosition('right');
      } else {
        setAdjustedPosition(position);
      }
    }
  }, [show, position]);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800 dark:border-t-gray-200 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 dark:border-b-gray-200 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800 dark:border-l-gray-200 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800 dark:border-r-gray-200 border-y-transparent border-l-transparent',
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => { e.preventDefault(); setShow(!show); }}
        className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-help"
        aria-label="Help"
      >
        <FiHelpCircle className={iconSize} />
      </button>

      {show && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 ${positionClasses[adjustedPosition]} pointer-events-none`}
        >
          <div className="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs rounded-lg py-2 px-3 max-w-[220px] shadow-lg leading-relaxed whitespace-normal">
            {text}
          </div>
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[adjustedPosition]}`} />
        </div>
      )}
    </span>
  );
}
