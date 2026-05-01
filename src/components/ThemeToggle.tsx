import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme } from '../lib/theme';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const [dark, setDark] = useState(() => getTheme() === 'dark');

  const toggle = () => {
    const next = toggleTheme();
    setDark(next === 'dark');
  };

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${className}`}
      style={{ color: 'var(--text2)' }}
    >
      {dark
        ? <Sun size={15} style={{ color: '#f59e0b' }} />
        : <Moon size={15} />}
      <span>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
