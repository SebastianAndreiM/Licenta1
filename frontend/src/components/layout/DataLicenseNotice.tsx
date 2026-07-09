import React, { useState, useEffect } from 'react';

const SEEN_KEY = 'data_license_seen_v1';

interface DataLicenseNoticeProps {
    forceOpen?: boolean;
    onClose?: () => void;
}

const LICENSE_CONTENT = (
    <div className="flex flex-col gap-4 text-sm text-gray-700 dark:text-gray-300">
        <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Sentinel-2 (Copernicus)
            </h4>
            <p>
                Contains modified Copernicus Sentinel data [2015-2025], processed by ESA.{' '}
                <a
                    href="https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline"
                >
                    sentinels.copernicus.eu
                </a>
            </p>
        </div>

        <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                ERA5-Land (C3S / ECMWF)
            </h4>
            <p>
                Generated using Copernicus Climate Change Service information [2015-2025].
                CC-BY licence — DOI: 10.24381/cds.e2161bac{' '}
                <a
                    href="https://cds.climate.copernicus.eu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline"
                >
                    cds.climate.copernicus.eu
                </a>
            </p>
        </div>

        <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Harti
            </h4>
            <p>
                © OpenStreetMap contributors (ODbL) · Leaflet (BSD-2-Clause)
            </p>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
            Aceasta aplicatie este un prototip academic dezvoltat pentru demonstratie in cadrul
            unei lucrari de licenta. Nu este un produs oficial Copernicus, ESA, ECMWF sau al
            Comisiei Europene si nu trebuie folosita pentru decizii operationale, legale, financiare,
            agricole sau comerciale fara validare independenta. Nici Comisia Europeana, nici ECMWF
            nu sunt responsabile pentru utilizarea informatiilor continute.
        </p>
    </div>
);

export const DataLicenseNotice: React.FC<DataLicenseNoticeProps> = ({ forceOpen, onClose }) => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (forceOpen) {
            setOpen(true);
            return;
        }
        try {
            const seen = localStorage.getItem(SEEN_KEY);
            if (!seen) setOpen(true);
        } catch {
            setOpen(true);
        }
    }, [forceOpen]);

    const handleClose = () => {
        setOpen(false);
        try {
            localStorage.setItem(SEEN_KEY, '1');
        } catch { /* empty */ }
        onClose?.();
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-gray-900 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        Surse de date si licentiere
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
                        aria-label="Inchide"
                    >
                        ×
                    </button>
                </div>
                <div className="px-5 py-4">
                    {LICENSE_CONTENT}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-[var(--copernicus-green)] text-white text-sm"
                    >
                        Am inteles
                    </button>
                </div>
            </div>
        </div>
    );
};

export const DataLicenseButton: React.FC = () => {
    const [showAgain, setShowAgain] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowAgain(true)}
                className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
            >
                Surse de date si licentiere
            </button>
            {showAgain && (
                <DataLicenseNotice forceOpen onClose={() => setShowAgain(false)} />
            )}
        </>
    );
};