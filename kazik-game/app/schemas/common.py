from pydantic import BaseModel
from typing import Any, Optional

class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None
    trace_id: Optional[str] = None

class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[dict[str, Any]] = None
