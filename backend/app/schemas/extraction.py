from typing import Optional, List
from pydantic import BaseModel

class ExtractionStartRequest(BaseModel):
    county:str
    start_year:int
    end_year:int
    start_month:int
    end_month:int

class ExtractionStartResponse(BaseModel):
    extraction_id:int
    status:str
    message:str

class ExtractionStatusResponse(BaseModel):
    extraction_id:int
    status:str
    progress:int
    message:Optional[str] = None
    logs:List[str] = []
    started_at:str
    completed_at:Optional[str] = None

    class Config:
        from_attributes = True
