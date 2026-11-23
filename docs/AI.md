# Подключение ИИ (GigaChat) к чату с Юви

Инструкция для разработчика, который будет настраивать ИИ. Всё остальное приложение уже работает —
трогать нужно только `api/app/ai/` и переменные окружения на сервере.

## Как устроен чат сейчас

```
Mini App (web/src/screens/Chat.tsx)
  └─ 4 уточняющих вопроса → lib/assistant.ts → getAssistant()
        ├─ ИИ выключен (по умолчанию) → ScriptedAssistant: правила из lib/triage.ts, на клиенте
        └─ ИИ включён (/v1/config → ai_enabled) → RemoteAssistant → POST https://api.kodtela.tech/v1/chat
                                                                     └─ api/app/main.py: chat()
                                                                          └─ api/app/ai/providers.py: get_provider()
```

Если сервер не ответил, ответил ошибкой или ответ нарушил правила — клиент сам покажет ответ по правилам.
Пользователь никогда не останется без ответа.

## Правила безопасности (не обходить)

Согласованы с научным руководителем и 152-ФЗ, проверяются автотестами:

1. **Красные флаги** (сильное кровотечение, острая боль, обморок, боль/кровь при беременности, мысли о суициде…)
   проверяются ДО модели — и на клиенте (`web/src/lib/triage.ts`), и на сервере (`api/app/ai/safety.py`).
   Ответ — 103/112 или телефон доверия. Модель не вызывается.
2. **Запрещено**: «это норма», «вариант нормы», «ничего страшного», диагнозы, лекарства и дозировки.
   Фильтр `FORBIDDEN` в `safety.py` (и в `triage.ts`) — если модель так ответила, ответ не отдаётся (502),
   клиент покажет безопасный ответ по правилам. Списки в двух файлах должны совпадать.
3. **Без персональных данных**: в модель уходит только текст жалобы, ответы на вопросы, фаза и день цикла,
   последние сообщения диалога. Никаких имён и Telegram ID (см. `build_messages`, тест `test_ai_prompt_has_no_personal_data`).

## Что сделать

1. Получить ключ авторизации GigaChat API (Authorization key) в личном кабинете https://developers.sber.ru/studio.
2. Добавить в образ корневой сертификат НУЦ Минцифры (GigaChat использует его для HTTPS):
   скачать `russian_trusted_root_ca.cer` с https://www.gosuslugi.ru/crt, положить в `api/certs/`
   и в `api/Dockerfile` добавить:
   ```dockerfile
   COPY certs/russian_trusted_root_ca.cer /usr/local/share/ca-certificates/russian_trusted_root_ca.crt
   RUN update-ca-certificates
   ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
   ```
3. Довести `GigaChatProvider` в `api/app/ai/providers.py` (там TODO): проверить OAuth и вызов
   `chat/completions` на реальном ключе, настроить `SYSTEM_PROMPT` в `safety.py`.
   По желанию — просить модель отвечать JSON и собирать `verdict` (`info` / `doctor`, поля как в `ai/base.py`),
   тогда в чате будет красивая карточка «Что можно сделать / Когда стоит обратиться к врачу».
4. Прогнать тесты: `cd api && python -m pytest -q`. Добавить свои тесты на провайдера (с подменой HTTP).
5. Включить на сервере — в `/srv/kodtela/.env`:
   ```
   AI_ENABLED=true
   AI_PROVIDER=gigachat
   GIGACHAT_AUTH_KEY=...
   ```
   и перезапустить: `cd /srv/kodtela && docker compose up -d api`.
   Выключить ИИ обратно — `AI_ENABLED=false`, приложение сразу вернётся к ответам по правилам.

## Лимиты

`CHAT_PER_HOUR` (по умолчанию 30 запросов в час на пользователя). Ответ модели — до 600 токенов, таймаут 30 с.

## Юридически

Передача текста в GigaChat — поручение обработки ПАО Сбербанк. Это уже описано в политике конфиденциальности
(`web/src/lib/legal.ts`, раздел 5). Если меняете состав передаваемых данных — обновите текст и `CONSENT_VERSION`.
