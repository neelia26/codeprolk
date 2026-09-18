from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal
from datetime import date


class UserCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
    )

    email: EmailStr

    whatsapp_number: str = Field(
        ...,
        min_length=7,
        max_length=20,
    )

    password: str = Field(
        ...,
        min_length=8,
    )


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str

    class Config:
        orm_mode = True


class QuizCreate(BaseModel):
    quiz_type: Literal["multiple_choice", "word_search", "bug_hunt", "optimal_point"] = "multiple_choice"
    question: str = Field(
        ...,
        min_length=1,
    )

    options: List[str] = Field(default_factory=list, max_items=4)

    correct_index: int = Field(
        default=0,
        ge=0,
        le=3,
    )

    explanation: str = Field(
        default="",
        max_length=4000,
    )

    date: date
    word_search_items: Optional[List[dict]] = None
    bug_hunt_rounds: Optional[List[dict]] = None
    optimal_point_rounds: Optional[List[dict]] = None
    duration_seconds: int = Field(default=180, ge=60, le=900)


class WordSearchSelection(BaseModel):
    quiz_id: int
    cells: List[List[int]] = Field(..., min_items=2, max_items=30)


class BugHuntAnswer(BaseModel):
    quiz_id: int
    line_index: int = Field(..., ge=0, le=30)
    diagnosis_index: int = Field(..., ge=0, le=4)
    fix_index: int = Field(..., ge=0, le=4)


class OptimalPointAnswer(BaseModel):
    quiz_id: int
    x: float = Field(..., ge=0, le=100)
    y: float = Field(..., ge=0, le=100)


class QuizOut(BaseModel):
    id: int
    question: str
    options: List[str]
    date: date

    class Config:
        orm_mode = True


class SubmitAnswer(BaseModel):
    quiz_id: int

    selected_index: int = Field(
        ...,
        ge=0,
        le=3,
    )
