import { DataLicenseButton } from './DataLicenseNotice';

export const PortalFooter = () => {
    return (
        <footer className="portal-footer">
            <div className="footer-credits">
                <div className="footer-credit">
                    <strong>Sentinel-2 (Copernicus)</strong>
                    <span>Contains modified Copernicus Sentinel data [2015-2025], processed by ESA.</span>
                    <a href="https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2" target="_blank" rel="noreferrer">
                        sentinels.copernicus.eu
                    </a>
                </div>

                <div className="footer-credit">
                    <strong>ERA5-Land (C3S / ECMWF)</strong>
                    <span>
                        Generated using Copernicus Climate Change Service information [2015-2025].
                        CC-BY licence — DOI: 10.24381/cds.e2161bac
                    </span>
                    <a href="https://cds.climate.copernicus.eu" target="_blank" rel="noreferrer">
                        cds.climate.copernicus.eu
                    </a>
                </div>
            </div>

            <p>
                This application is an academic prototype developed for thesis/research demonstration only.
                It is not an official Copernicus, ESA, ECMWF or European Commission product and must not be
                used for operational, legal, financial, agricultural or commercial decision-making without
                independent validation. Neither the European Commission nor ECMWF is responsible for any use
                that may be made of the Copernicus information or data it contains.
            </p>

            <div style={{ marginTop: 12 }}>
                <DataLicenseButton />
            </div>
        </footer>
    );
};