import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    subtitle?: string;
}

export const Card: React.FC<CardProps> = ({
                                              children,
                                              className = '',
                                              title,
                                              subtitle,
                                          }) => {
    return (
        <div className={`
      bg-white dark:bg-gray-900
      border border-gray-200 dark:border-gray-700
      rounded-xl shadow-sm
      ${className}
    `}>
            {(title || subtitle) && (
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    {title && (
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                        </h3>
                    )}
                    {subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            )}
            <div className="p-5">
                {children}
            </div>
        </div>
    );
};