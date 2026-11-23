"""Провайдеры ИИ: заглушка и GigaChat.

GigaChat — заготовка для разработчика, который будет настраивать ИИ (см. docs/AI.md).
Документация: https://developers.sber.ru/docs/ru/gigachat/api/overview
"""

import time
import uuid

import httpx

from ..config import Settings
from .base import ChatProvider, ChatReply, ChatRequest, ProviderUnavailable
from .safety import SYSTEM_PROMPT

PHASE_NAMES = {"menstrual": "менструальная", "follicular": "фолликулярная", "ovulation": "овуляторная", "luteal": "лютеиновая"}


def build_messages(req: ChatRequest) -> list[dict]:
    """Сообщения для модели. Персональных данных (имя, Telegram ID) здесь нет — только сам вопрос и контекст цикла."""
    ctx = []
    if req.phase:
        ctx.append(f"фаза цикла: {PHASE_NAMES[req.phase]}")
    if req.cycleDay:
        ctx.append(f"день цикла: {req.cycleDay}")
    answers = "; ".join(f"{k}: {v}" for k, v in req.answers.items())
    msgs: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in req.history[-10:]:
        msgs.append({"role": m.role, "content": m.text})
    msgs.append({"role": "user", "content": f"Жалоба: {req.symptom}\nУточнения: {answers or '—'}\nКонтекст: {', '.join(ctx) or '—'}"})
    return msgs


class StubProvider:
    """Ответ без модели — для проверки цепочки. В проде при ai_enabled=false чат работает правилами на клиенте."""

    name = "stub"

    async def reply(self, req: ChatRequest) -> ChatReply:
        return ChatReply(
            text="Спасибо, что рассказала. Я пока учусь отвечать сама — вот общие подсказки.",
            verdict={
                "level": "info",
                "title": "Вот что можно знать",
                "explanation": "Причины таких ощущений бывают разными. Определить их может только врач.",
                "plan": ["Отмечай самочувствие в дневнике", "Отдыхай и пей воду"],
                "whenDoctor": ["Если симптом держится дольше двух недель", "Если становится сильнее"],
            },
        )


class GigaChatProvider:
    """GigaChat API. TODO(разработчик ИИ): проверить на реальном ключе, настроить промпт и формат ответа.

    Важно: API GigaChat использует сертификат НУЦ Минцифры
    — его нужно добавить в образ (см. docs/AI.md), иначе будет ошибка SSL.
    """

    name = "gigachat"
    OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

    def __init__(self, s: Settings):
        if not s.gigachat_auth_key:
            raise ProviderUnavailable("GIGACHAT_AUTH_KEY is empty")
        self._s = s
        self._token: str | None = None
        self._token_exp = 0.0

    async def _access_token(self, client: httpx.AsyncClient) -> str:
        if self._token and time.time() < self._token_exp - 60:
            return self._token
        r = await client.post(
            self.OAUTH_URL,
            headers={"Authorization": f"Basic {self._s.gigachat_auth_key}", "RqUID": str(uuid.uuid4()), "Accept": "application/json"},
            data={"scope": self._s.gigachat_scope},
        )
        r.raise_for_status()
        data = r.json()
        self._token = data["access_token"]
        self._token_exp = data.get("expires_at", 0) / 1000 or time.time() + 1500
        return self._token

    async def reply(self, req: ChatRequest) -> ChatReply:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                token = await self._access_token(client)
                r = await client.post(
                    self.CHAT_URL,
                    headers={"Authorization": f"Bearer {token}"},
                    json={"model": self._s.gigachat_model, "messages": build_messages(req), "temperature": 0.3, "max_tokens": 600},
                )
                r.raise_for_status()
                text = r.json()["choices"][0]["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
            raise ProviderUnavailable(str(e)) from e
        # TODO(разработчик ИИ): при желании просить модель отвечать JSON и собирать verdict (info/doctor)
        return ChatReply(text=text)


_cache: dict[str, ChatProvider] = {}


def get_provider(s: Settings) -> ChatProvider:
    if s.ai_provider not in _cache:
        if s.ai_provider == "gigachat":
            _cache[s.ai_provider] = GigaChatProvider(s)
        else:
            _cache[s.ai_provider] = StubProvider()
    return _cache[s.ai_provider]
