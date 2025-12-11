import React from 'react';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    onChange(event.target.checked);
  };

  return (
    <label
      className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {label && <span>{label}</span>}
      <span className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={`absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none left-0 top-0 transition-transform duration-200 ease-in transform checked:translate-x-4 ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        />
        <span
          className={`block overflow-hidden h-6 rounded-full transition-colors duration-200 ease-in ${
            checked ? 'bg-blue-600' : 'bg-gray-300'
          } ${disabled ? 'opacity-60' : ''}`}
        />
      </span>
    </label>
  );
};