"use client";

import { useTheme } from './useTheme';
import { COLORS } from 'shared/utils/brandColors';

export function useThemeColors() {
  const { isDark } = useTheme();

  const getHeaderStyle = (isBusinessContext: boolean, businessColor?: string) => {
    if (isBusinessContext && businessColor) {
      return {
        backgroundColor: businessColor,
        color: '#ffffff',
      };
    }
    
    // Use same color as sidebar for consistency
    return {
      backgroundColor: isDark ? '#374151' : COLORS.neutralMid, // gray-700 in dark mode, matches sidebar
      color: '#ffffff',
    };
  };

  const getBackgroundColor = () => ({
    backgroundColor: isDark ? '#111827' : '#ffffff', // gray-900 vs white
    color: isDark ? '#f9fafb' : '#111827', // gray-50 vs gray-900
  });

  const getSidebarStyle = (isBusinessContext: boolean, businessColor?: string) => {
    if (isBusinessContext && businessColor) {
      return {
        backgroundColor: businessColor,
        color: '#ffffff',
      };
    }
    
    return {
      backgroundColor: isDark ? '#374151' : COLORS.neutralMid, // gray-700 in dark mode
      color: '#ffffff',
    };
  };

  const getBrandColor = (colorName: keyof typeof COLORS) => {
    // In dark mode, use the CSS variable versions which are already adjusted
    if (isDark) {
      const colorMap: Record<keyof typeof COLORS, string> = {
        accentRed: '#ff6b47',
        primaryGreen: '#4ade80',
        highlightYellow: '#fbbf24',
        secondaryPurple: '#c084fc',
        infoBlue: '#60a5fa',
        neutralDark: '#f1f5f9',
        neutralMid: '#e2e8f0',
        neutralLight: '#1e293b',
      };
      return colorMap[colorName] || COLORS[colorName];
    }
    
    return COLORS[colorName];
  };

  return {
    getHeaderStyle,
    getBackgroundColor,
    getSidebarStyle,
    getBrandColor,
    isDark,
  };
}
