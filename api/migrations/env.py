from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app.config import get_settings
from app.db import Base

if context.config.config_file_name:
    fileConfig(context.config.config_file_name)


def run() -> None:
    engine = create_engine(get_settings().db_url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=Base.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run()
