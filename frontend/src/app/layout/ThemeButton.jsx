import React from 'react';
import { Sun, Moon } from 'lucide-react';

import { IconButton } from '../../shared/ui/index';

export function ThemeButton({ theme, onClick }) {
  return (
    <IconButton
      className="theme-toggle"
      icon={theme === 'dark' ? Sun : Moon}
      label={theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن'}
      aria-pressed={theme === 'light'}
      onClick={onClick}
    />
  );
}
