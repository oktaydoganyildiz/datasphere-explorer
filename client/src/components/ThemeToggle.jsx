import React from 'react';
import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../store/themeStore';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
};

export default ThemeToggle;
