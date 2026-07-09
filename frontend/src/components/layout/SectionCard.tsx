import React from 'react';

interface SectionCardProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
                                                            title,
                                                            subtitle,
                                                            actions,
                                                            children,
                                                        }) => {
    return (
        <section className="section-card">
            <div className="section-card-header">
                <div>
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>

                {actions && <div>{actions}</div>}
            </div>

            <div className="section-card-body">
                {children}
            </div>
        </section>
    );
};