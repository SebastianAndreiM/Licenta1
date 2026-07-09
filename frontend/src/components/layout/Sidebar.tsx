import React from 'react';
import type { TranslationKeys } from '../../i18n';

export type DashboardView =
    | 'overview' | 'trend' | 'table' | 'correlation' | 'images' | 'anomalies' | 'logs';

interface SidebarItem {
    view: DashboardView;
    label: string;
    desc: string;
    icon: React.ReactNode;
}

interface SidebarProps {
    activeView: DashboardView;
    onSelect: (view: DashboardView) => void;
    hasData: boolean;
    t: TranslationKeys;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelect, hasData, t }) => {
    const items: SidebarItem[] = [
        {
            view: 'overview', label: t.sidebar.overview,
            desc: 'Sumar: scor de risc, NDVI mediu si starea generala a zonei',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" /></svg>,
        },
        {
            view: 'trend', label: t.sidebar.trend,
            desc: 'Grafic cu evolutia vegetatiei (NDVI) an de an',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" /></svg>,
        },
        {
            view: 'table', label: t.sidebar.table,
            desc: 'Tabel cu toate masuratorile: NDVI, nori, temperatura, ploaie',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 10h18M3 15h18M3 20h18" /></svg>,
        },
        {
            view: 'correlation', label: t.sidebar.correlation,
            desc: 'Cum influenteaza clima (ploaie, temperatura) vegetatia',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="7" cy="14" r="1.5" /><circle cx="11" cy="9" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="18" cy="6" r="1.5" /><path strokeLinecap="round" d="M3 21V3" /><path strokeLinecap="round" d="M3 21h18" /></svg>,
        },
        {
            view: 'images', label: t.sidebar.images,
            desc: 'Fotografii satelitare reale ale zonei selectate',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" /><circle cx="8.5" cy="8.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" /></svg>,
        },
        {
            view: 'anomalies', label: 'Anomalii AI',
            desc: 'Zone unde vegetatia difera de ce prezice modelul din clima',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 16H3l9-16z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v4M12 17h.01" /></svg>,
        },
        {
            view: 'logs', label: t.sidebar.logs,
            desc: 'Pasii tehnici prin care au fost extrase datele',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>,
        },
    ];

    return (
        <nav className="edu-sidebar">
            <div className="edu-sidebar-title">Sectiuni analiza</div>
            <ul className="flex flex-col pb-2">
                {items.map(item => {
                    const isActive = activeView === item.view;
                    const disabled = !hasData && item.view !== 'overview' && item.view !== 'logs' && item.view !== 'anomalies';
                    return (
                        <li key={item.view}>
                            <button
                                onClick={() => !disabled && onSelect(item.view)}
                                disabled={disabled}
                                className={`edu-tab ${isActive ? 'active' : ''}`}
                            >
                                <span className="edu-tab-icon">{item.icon}</span>
                                <span>
                                    <span className="edu-tab-label block">{item.label}</span>
                                    <span className="edu-tab-desc block">{item.desc}</span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};