import { useState } from "react";
import type {DashboardData, ExtractionStatus, QueryParams} from "../types/dashboard.types.ts";

const useDashboardData = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extraction, setExtraction] = useState<ExtractionStatus | null>(null);

    const query = async (_params: QueryParams, _token:string)=>{
        setIsLoading(true);
        setError(null);
        setExtraction(null);
        //MOCK DATE REALE
        try{
            await new Promise(resolve => setTimeout(resolve, 1500));
            setData(null); //aici cuplez de backend fra
        }catch(err){
            setError('A aparut o eroare la extragerea datelor.');
        }finally {
            setIsLoading(false);
        }
    };

    const reset = () =>{
        setData(null);
        setError(null);
        setExtraction(null);
    };
    return {
        data,
        isLoading,
        error,
        extraction,
        query,
        reset,
        setData,
        setExtraction,
    };
}
export default useDashboardData