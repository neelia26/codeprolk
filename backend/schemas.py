from pydantic import BaseModel, EmailStr, Field
from typing import List
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
    question: str = Field(
        ...,
        min_length=1,
    )

    options: List[str] = Field(
        ...,
        min_items=4,
        max_items=4,
    )

    correct_index: int = Field(
        ...,
        ge=0,
        le=3,
    )

    date: date


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