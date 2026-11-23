"""Интерфейс ИИ-провайдера для чата с Юви.

Чтобы подключить модель, реализуйте ChatProvider.reply и зарегистрируйте её в get_provider().
Формат запроса/ответа совпадает с web/src/lib/assistant.ts.
"""

from typing import Literal, Protocol

from pydantic import BaseModel, Field


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    symptom: str = Field(max_length=1000)
    answers: dict[str, str] = Field(default_factory=dict)
    phase: Literal["menstrual", "follicular", "ovulation", "luteal"] | None = None
    cycleDay: int | None = Field(default=None, ge=1, le=120)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=20)


class Verdict(BaseModel):
    level: Literal["info", "doctor", "emergency"]
    title: str
    explanation: str
    plan: list[str]
    whenDoctor: list[str] = Field(default_factory=list)


class ChatReply(BaseModel):
    text: str
    verdict: Verdict | None = None


class ChatProvider(Protocol):
    name: str

    async def reply(self, req: ChatRequest) -> ChatReply: ...


class ProviderUnavailable(Exception):
    """Модель недоступна — клиент покажет ответ по правилам."""
