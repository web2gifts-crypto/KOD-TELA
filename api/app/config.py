"""Настройки берутся из переменных окружения (файл /srv/kodtela/.env на сервере).

Секреты (BOT_TOKEN, пароль БД, DATA_KEY) никогда не коммитятся в репозиторий.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # либо целиком DATABASE_URL, либо по частям DB_* (пароль тогда вставляется как есть, без экранирования)
    database_url: str = ""
    db_host: str = ""
    db_port: int = 5432
    db_name: str = "default_db"
    db_user: str = "gen_user"
    db_password: str = ""
    # токен бота — им проверяется подпись initData и отправляются файлы в чат
    bot_token: str = ""
    # 32 байта в base64 — ключ шифрования данных о здоровье (AES-256-GCM)
    data_key: str = ""
    # сколько секунд действительна подпись initData
    init_data_ttl: int = 24 * 3600
    # откуда разрешены запросы (Mini App)
    allowed_origins: str = "https://app.kodtela.tech"
    # адреса — для кнопок бота и вебхука
    webapp_url: str = "https://app.kodtela.tech/"
    public_api_url: str = "https://api.kodtela.tech"
    bot_username: str = "kodtela_app"
    # как бот получает сообщения: polling — воркер сам забирает их (getUpdates); webhook — Telegram стучится к нам.
    # С российского сервера входящие соединения от Telegram режутся, поэтому на проде — polling.
    bot_mode: str = "off"  # off | polling | webhook
    bot_webhook: bool = False  # устарело: то же, что bot_mode=webhook
    # чат, куда бот шлёт технические алерты (ошибки API, сбои воркера); пусто — никуда
    admin_chat_id: int | None = None
    # текущая версия согласия на обработку данных; при смене — спросим заново
    consent_version: str = "2026-11-23.2"

    # --- ИИ (GigaChat). Настраивает отдельный разработчик, см. docs/AI.md ---
    ai_enabled: bool = False
    ai_provider: str = "stub"  # stub | gigachat
    gigachat_auth_key: str = ""  # ключ авторизации из личного кабинета Sber
    gigachat_scope: str = "GIGACHAT_API_PERS"
    gigachat_model: str = "GigaChat"

    # «Код Тела+»: цены в звёздах Telegram
    plus_month_stars: int = 149
    plus_year_stars: int = 1190
    # лимиты по тарифам
    ai_per_day_free: int = 5
    ai_per_day_plus: int = 100
    partners_free: int = 1
    partners_plus: int = 3

    # лимиты
    max_entry_bytes: int = 1_000_000
    chat_per_hour: int = 30
    export_per_hour: int = 10


    @property
    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        if self.db_host:
            from urllib.parse import quote

            return f"postgresql+psycopg://{quote(self.db_user, safe='')}:{quote(self.db_password, safe='')}@{self.db_host}:{self.db_port}/{self.db_name}"
        return "sqlite:///./dev.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
