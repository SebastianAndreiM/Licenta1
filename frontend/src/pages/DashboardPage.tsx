import React, { useState, useEffect } from 'react';
import { MetricsGrid } from '../components/dashboard/MetricsGrid';
import { SatelliteImageViewer } from '../components/dashboard/SatelliteImageViewer';
import { ExportButton } from '../components/dashboard/ExportButton';
import { PublicPortalHeader } from '../components/layout/PublicPortalHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { Sidebar } from '../components/layout/Sidebar';
import type { DashboardView } from '../components/layout/Sidebar';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import type { User } from '../types/auth.types';
import type { QueryParams } from '../types/dashboard.types';
import type { Era5DataPoint } from '../types/era5.types';
import { PortalFooter } from '../components/layout/PortalFooter';
import { dashboardApi } from '../services/dashboardApi';
import { NdviTrendChart } from '../components/dashboard/charts/NdviTrendChart';
import { DatasetTable } from '../components/dashboard/DatasetTable';
import { Era5CorrelationChart } from '../components/dashboard/charts/Era5CorrelationChart';
import { RiskSummary } from '../components/dashboard/RiskSummary';
import type { AnalysisResult, TemporalCoverageResult,AnomalyResult } from '../services/dashboardApi';
import { extractionApi } from '../services/extractionApi';
import type { JobStatus } from '../services/extractionApi';
import type { SentinelScene } from '../types/sentinel.types';
import { RegionMap } from '../components/dashboard/RegionMap';
import { BboxSummary } from '../components/dashboard/BboxSummary.tsx';
import { PeriodSelector } from '../components/dashboard/PeriodSelector';
import type { Bbox, AnomalyCell } from '../components/dashboard/RegionMap';
import { DataLicenseNotice } from '../components/layout/DataLicenseNotice';
import {AnomalyPanel} from "../components/dashboard/AnomalyPanel.tsx";

const MONTH_NAMES = [
    'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
    'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec',
];

interface DashboardPageProps {
    user: User | null;
    onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
    const { theme, toggleTheme } = useTheme();
    const { t, language, toggleLanguage } = useLanguage();

    const [params, setParams] = useState<QueryParams>({
        county: 'Calarasi',
        startYear: 2015,
        endYear: 2022,
        startMonth: 1,
        endMonth: 12,
    });

    const [scenes, setScenes] = useState<SentinelScene[]>([]);
    const [era5Data, setEra5Data] = useState<Era5DataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [activeView, setActiveView] = useState<DashboardView>('overview');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [jobId, setJobId] = useState<number | null>(null);
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [bbox, setBbox] = useState<Bbox | null>(null);
    const [bboxSceneCount, setBboxSceneCount] = useState<number | null>(null);
    const [checkingBbox, setCheckingBbox] = useState(false);
    const [missingCoverage, setMissingCoverage] = useState<TemporalCoverageResult | null>(null);
    const [anomalyCells, setAnomalyCells] = useState<AnomalyCell[]>([]);
    const [loadingAnomalies, setLoadingAnomalies] = useState(false);
    const [, setAnomalySummary] = useState<AnomalyResult['summary'] | null>(null);

    const hasData = scenes.length > 0;

    const [anomalyYear, setAnomalyYear] = useState(2019);
    const [anomalyMonth, setAnomalyMonth] = useState(7);
    const [selectedCell, setSelectedCell] = useState<{cell_lat: number; cell_lon: number} | null>(null);

    // La montarea paginii: recuperam un eventual job activ al userului,
    // ca sa nu pierdem logurile de extragere daca a navigat / dat refresh.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const active = await extractionApi.myActive();
                if (cancelled || !active || active.length === 0) return;
                const job = active[0];   // cel mai recent job activ
                if (job.job_id == null) return;
                setJobId(job.job_id);
                setJobStatus(job);
                setHasSearched(true);
                setActiveView('logs');
            } catch {
                // daca nu merge, nu-i grav - pur si simplu nu recuperam nimic
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Polling status job
    useEffect(() => {
        if (jobId === null) return;
        if (
            jobStatus?.status === 'completed' ||
            jobStatus?.status === 'failed' ||
            jobStatus?.status === 'cancelled'
        ) return;

        const interval = setInterval(async () => {
            try {
                const st = await extractionApi.status(jobId);
                setJobStatus(st);

                if (st.status === 'completed') {
                    clearInterval(interval);
                    if (bbox) {
                        const response = await dashboardApi.queryBbox(bbox, params);
                        setScenes(response.scenes);
                        setEra5Data(response.era5Data);
                        setAnalysis(null);
                        setHasSearched(true);
                    }
                } else if (st.status === 'failed' || st.status === 'cancelled') {
                    clearInterval(interval);
                }
            } catch {
                clearInterval(interval);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [jobId, jobStatus?.status, params, bbox]);

    // Re-verifica numarul de scene cand se schimba perioada (nu doar la desenare)
    useEffect(() => {
        if (!bbox) return;
        let cancelled = false;
        (async () => {
            setCheckingBbox(true);
            setBboxSceneCount(null);
            try {
                const response = await dashboardApi.queryBbox(bbox, params);
                if (!cancelled) setBboxSceneCount(response.scenesCount);
            } catch {
                if (!cancelled) setBboxSceneCount(0);
            } finally {
                if (!cancelled) setCheckingBbox(false);
            }
        })();
        return () => { cancelled = true; };
    }, [params.startYear, params.endYear, params.startMonth, params.endMonth, bbox]);
    const handleChange = (field: string, value: string | number) => {
        setParams(prev => ({ ...prev, [field]: value }));
    };

    const handleBboxChange = async (newBbox: Bbox) => {
        setBbox(newBbox);
        setCheckingBbox(true);
        setBboxSceneCount(null);
        try {
            const response = await dashboardApi.queryBbox(newBbox, params);
            setBboxSceneCount(response.scenesCount);
        } catch {
            setBboxSceneCount(0);
        } finally {
            setCheckingBbox(false);
        }
    };

    const handleAnalyzeBbox = async () => {
        if (!bbox) return;
        setIsLoading(true);
        setHasSearched(true);
        setJobStatus(null);
        setJobId(null);
        setMissingCoverage(null);

        try {
            // Datele existente pentru bbox + perioada
            const response = await dashboardApi.queryBbox(bbox, params);
            const sceneCount = response.scenesCount ?? 0;

            // Verificam acoperirea TEMPORALA (luna cu luna, sezonier)
            let temporal: TemporalCoverageResult | null = null;
            try {
                temporal = await dashboardApi.temporalCoverage(bbox, params);
                console.log('Temporal:', temporal.presentPeriods, '/', temporal.totalPeriods,
                    'luni acoperite | lipsesc:', temporal.missingPeriods);
            } catch {
                temporal = null;
            }

            // Cazul 1: nicio scena deloc -> extragem direct (perioada complet goala)
            if (sceneCount === 0) {
                await startExtraction();
                return;
            }

            // Cazul 2: avem date -> le afisam. Daca lipsesc luni, retinem pentru banner.
            setScenes(response.scenes);
            setEra5Data(response.era5Data);
            setAnalysis(null);
            setActiveView('overview');

            if (temporal && !temporal.fullyCovered) {
                setMissingCoverage(temporal);
            }
        } catch (err) {
            console.error('Eroare handleAnalyzeBbox:', err);
            setScenes([]);
            setEra5Data([]);
            setAnalysis(null);
        } finally {
            setIsLoading(false);
        }
    };

    // Porneste extragerea pe bbox si intra in modul logs.
    const startExtraction = async () => {
        if (!bbox) return;
        setMissingCoverage(null);

        const startRes = await extractionApi.startBbox(bbox, params);
        setJobId(startRes.job_id);
        setJobStatus({
            found: true,
            job_id: startRes.job_id,
            status: 'pending',
            stage: 'queued',
            progress: 0,
            message: 'Extragere pornita...',
            logs: '',
        });
        setActiveView('logs');
    };

    // Extragere ceruta manual pentru lunile lipsa (butonul din banner)
    const handleExtractMissing = async () => {
        await startExtraction();
    };

    const handleCancelJob = async () => {
        if (jobId === null) return;
        try {
            await extractionApi.cancel(jobId);
            setJobStatus(prev => prev ? { ...prev, status: 'cancelled', message: 'Anulare ceruta...' } : prev);
        } catch {
            // ignoram - daca a esuat anularea, jobul continua
        }
    };

    const handleLoadAnomalies = async () => {
        if (!bbox) return;
        setLoadingAnomalies(true);
        setSelectedCell(null);
        try {
            // trimitem an+luna alese in panou, un singur an/luna
            const res = await dashboardApi.anomalyBbox(bbox, {
                ...params,
                startYear: anomalyYear, endYear: anomalyYear,
                startMonth: anomalyMonth, endMonth: anomalyMonth,
            });
            setAnomalyCells(res.cells);
            setAnomalySummary(res.summary);
        } catch (err) {
            console.error('Eroare anomalii:', err);
            setAnomalyCells([]);
        } finally {
            setLoadingAnomalies(false);
        }
    };


    const renderActiveView = () => {
        if (activeView === 'logs') {
            if (!jobStatus) {
                return (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                        {t.dashboard.noExtraction}
                    </p>
                );
            }
            return (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                            {jobStatus.label || jobStatus.county} · {jobStatus.stage}
                        </span>
                        <span className={`text-xs px-2 py-0.5 ${
                            jobStatus.status === 'completed' ? 'bg-green-100 text-green-700'
                                : jobStatus.status === 'failed' ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                        }`}>
                            {jobStatus.status}
                        </span>
                        {(jobStatus.status === 'pending' || jobStatus.status === 'running') && (
                            <button
                                onClick={handleCancelJob}
                                className="ml-auto text-xs px-3 py-1 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                Anuleaza extragerea
                            </button>
                        )}
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2">
                        <div
                            className="h-2 bg-[var(--copernicus-green)] transition-all"
                            style={{ width: `${jobStatus.progress ?? 0}%` }}
                        />
                    </div>
                    <pre className="bg-gray-900 text-gray-100 text-xs p-4 overflow-x-auto whitespace-pre-wrap max-h-80">
                        {jobStatus.logs || 'Se asteapta...'}
                    </pre>
                </div>
            );
        }

        if (!hasData) {
            return (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                    {t.dashboard.noData}
                </p>
            );
        }

        switch (activeView) {
            case 'overview':
                return (
                    <div className="flex flex-col gap-5">
                        {missingCoverage && !missingCoverage.fullyCovered && (
                            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                                        Acoperire temporala partiala
                                    </span>
                                    <span className="text-xs text-amber-600 dark:text-amber-500">
                                        {missingCoverage.presentPeriods} din {missingCoverage.totalPeriods} luni au date
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Lipsesc:{' '}
                                    {missingCoverage.missing
                                        .map(m => `${MONTH_NAMES[m.month - 1]} ${m.year}`)
                                        .join(', ')}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                                    Notă: unele luni de toamnă/iarnă pot să nu producă date valide din cauza norilor.
                                </p>
                                <button
                                    onClick={handleExtractMissing}
                                    className="self-start mt-1 text-xs px-3 py-1.5 border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                >
                                    Incearca extragerea lunilor lipsa
                                </button>
                            </div>
                        )}
                        {analysis && <RiskSummary analysis={analysis} t={t} />}
                        <MetricsGrid scenes={scenes} era5Data={era5Data} t={t} />
                    </div>
                );
            case 'trend':
                return <NdviTrendChart scenes={scenes} t={t} />;
            case 'table':
                return <DatasetTable scenes={scenes} era5Data={era5Data} t={t} />;
            case 'correlation':
                return <Era5CorrelationChart scenes={scenes} era5Data={era5Data} t={t} />;
            case 'images':
                return <SatelliteImageViewer scenes={scenes} t={t} />;
            case 'anomalies':
                return (
                    <AnomalyPanel
                        year={anomalyYear}
                        month={anomalyMonth}
                        onYearChange={setAnomalyYear}
                        onMonthChange={setAnomalyMonth}
                        onCalculate={handleLoadAnomalies}
                        loading={loadingAnomalies}
                        cells={anomalyCells}
                        selectedCell={selectedCell}
                        onSelectCell={setSelectedCell}
                        hasBbox={!!bbox}
                    />
                );

            default:
                return null;
        }
    };

    const viewTitles: Record<DashboardView, string> = {
        overview: t.sidebar.overview,
        trend: t.sidebar.trend,
        table: t.sidebar.table,
        correlation: t.sidebar.correlation,
        images: t.sidebar.images,
        logs: t.sidebar.logs,
        anomalies: 'Anomalii AI',
    };

    return (
        <div className="portal-dashboard">
            <PublicPortalHeader
                user={user}
                theme={theme}
                language={language}
                onToggleTheme={toggleTheme}
                onToggleLanguage={toggleLanguage}
                onLogout={onLogout}
            />
            <DataLicenseNotice />
            <main className="portal-main">
                <section className="dashboard-hero">
                    <div className="dashboard-title-row">
                        <div className="brand-icon" style={{ margin: 0, width: 62, height: 62 }}>
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" stroke="currentColor" strokeWidth="2" />
                                <circle cx="12" cy="9" r="2.5" fill="currentColor" />
                            </svg>
                        </div>
                        <div>
                            <h1>{t.dashboard.title}</h1>
                            <p>{t.dashboard.subtitle}</p>
                            <div className="data-source-badges">
                                <span className="ds-badge sentinel"><span className="dot" /> Sentinel-2 · ESA Copernicus</span>
                                <span className="ds-badge era5"><span className="dot" /> ERA5-Land · C3S / ECMWF</span>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                    {/* Cutie unica - selectie regiune pe harta + perioada */}
                    <SectionCard title="Selecteaza regiunea si perioada">
                        <div className="flex flex-col gap-4">
                            {/* 1. Harta - alegi UNDE */}
                            <RegionMap
                                    onBboxChange={handleBboxChange}
                                    anomalyCells={activeView === 'anomalies' ? anomalyCells : undefined}
                                    selectedCell={activeView === 'anomalies' ? selectedCell : null}
                                   />
                            <BboxSummary bbox={bbox} sceneCount={bboxSceneCount} isChecking={checkingBbox} />

                            {/* 2. Perioada - alegi CAND */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <PeriodSelector
                                    startYear={params.startYear}
                                    endYear={params.endYear}
                                    startMonth={params.startMonth}
                                    endMonth={params.endMonth}
                                    onChange={handleChange}
                                    t={t}
                                />
                            </div>

                            {/* 3. Buton Analyze */}
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleAnalyzeBbox}
                                    isLoading={isLoading}
                                    disabled={!bbox}
                                    size="lg"
                                >
                                    Analizează regiunea selectată
                                </Button>
                                {hasData && (
                                    <div className="ml-auto">
                                        <ExportButton scenes={scenes} era5Data={era5Data} t={t} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    <div className="flex border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[400px]">
                        <Sidebar
                            activeView={activeView}
                            onSelect={setActiveView}
                            hasData={hasData}
                            t={t}
                        />
                        <div className="flex-1 flex flex-col">
                            <div className="section-card-header">
                                <h2>{viewTitles[activeView]}</h2>
                            </div>
                            <div className="p-6 flex-1">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Spinner size="lg" text={t.common.loading} />
                                    </div>
                                ) : !hasSearched ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                                        {t.dashboard.pressAnalyze}
                                    </p>
                                ) : (
                                    renderActiveView()
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <PortalFooter />
        </div>
    );
};