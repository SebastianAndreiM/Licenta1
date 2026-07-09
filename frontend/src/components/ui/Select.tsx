import React from 'react';

interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
                                                  label,
                                                  error,
                                                  options,
                                                  placeholder,
                                                  className = '',
                                                  ...rest
                                              }) => {
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <select
                className={`
          px-3 py-2 rounded-lg border text-sm
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          border-gray-300 dark:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
          transition-colors duration-200
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
                {...rest}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && (
                <span className="text-xs text-red-500">{error}</span>
            )}
        </div>
    );
};