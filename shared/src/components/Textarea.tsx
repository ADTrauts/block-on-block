import React from 'react';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea: React.FC<TextareaProps> = (props) => {
  return (
    <textarea
      className="px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-400 text-gray-900 placeholder:text-gray-400"
      {...props}
    />
  );
}; 