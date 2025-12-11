import React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ReactNode;
};

export const Input: React.FC<InputProps> = ({ icon, className, ...props }) => {
  if (!icon) {
    return (
      <input
        className={`px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-400 text-gray-900 placeholder:text-gray-400 ${className || ''}`}
        {...props}
      />
    );
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
      <input
        className={`pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-400 text-gray-900 placeholder:text-gray-400 ${className || ''}`}
        {...props}
      />
    </div>
  );
};