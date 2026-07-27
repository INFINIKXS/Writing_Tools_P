import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ showLabel = false, className = '' }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className={`relative flex items-center gap-2 min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl transition-all duration-200 
                ${isDark
                    ? 'bg-white/5 border border-white/10 text-amber-400 hover:bg-white/10 hover:border-amber-400/30'
                    : 'bg-slate-200/80 border border-slate-300 text-amber-600 hover:bg-slate-300 hover:border-amber-500/40'
                } 
                active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${className}`}
        >
            <div className="relative w-5 h-5 flex items-center justify-center">
                <Sun
                    size={18}
                    className={`absolute transition-all duration-300 transform ${
                        isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'
                    }`}
                />
                <Moon
                    size={18}
                    className={`absolute transition-all duration-300 transform ${
                        isDark ? 'rotate-0 scale-100 opacity-100 text-amber-400' : '-rotate-90 scale-0 opacity-0'
                    }`}
                />
            </div>

            {showLabel && (
                <span className={`text-xs font-semibold select-none ${isDark ? 'text-neutral-300' : 'text-slate-700'}`}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                </span>
            )}
        </button>
    );
}
