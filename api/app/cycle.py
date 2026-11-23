"""Прогноз цикла на сервере — порт web/src/lib/cycle.ts (buildCycleModel), нужен для напоминаний.
Алгоритм должен совпадать с фронтом: разрыв до 2 дней — те же месячные; длины циклов 15..60;
средняя по последним 6; округление как Math.round."""

import math
from dataclasses import dataclass
from datetime import date, timedelta


def _round(x: float) -> int:
    return math.floor(x + 0.5)


def period_runs(days: dict[str, int]) -> list[list[date]]:
    runs: list[list[date]] = []
    for d in sorted(date.fromisoformat(k) for k in days):
        if runs and (d - runs[-1][-1]).days <= 2:
            runs[-1].append(d)
        else:
            runs.append([d])
    return runs


@dataclass
class Forecast:
    last_start: date | None
    cycle_length: int
    expected: date | None  # ожидаемое начало следующих месячных
    late: bool
    ovulation: date | None  # ожидаемая овуляция в текущем/следующем цикле
    started_recently: bool  # месячные отмечены в последние дни (напоминать не нужно)


def forecast(period_days: dict[str, int] | None, settings: dict | None, today: date) -> Forecast:
    period_days = period_days or {}
    settings = settings or {}
    runs = period_runs(period_days)
    starts = [r[0] for r in runs]
    lengths = [(b - a).days for a, b in zip(starts, starts[1:]) if 15 <= (b - a).days <= 60]
    recent = lengths[-6:]
    cl = _round(sum(recent) / len(recent)) if recent else int(settings.get("cycleLength") or 28)
    last = starts[-1] if starts else None
    if last is None:
        return Forecast(None, cl, None, False, None, False)
    expected = last + timedelta(days=cl)
    late = expected <= today
    ov = last + timedelta(days=cl - 15)
    if ov < today:
        anchor = today + timedelta(days=1) if late else expected
        ov = anchor + timedelta(days=cl - 15)
    recent_mark = any(today - timedelta(days=5) <= d <= today + timedelta(days=1) for d in (date.fromisoformat(k) for k in period_days))
    return Forecast(last, cl, expected, late, ov, recent_mark)


PHASE_NAMES = {"menstrual": "Менструальная", "follicular": "Фолликулярная", "ovulation": "Овуляторная", "luteal": "Лютеиновая"}


def phase_for_day(day: int, cycle_length: int, period_length: int) -> str:
    ov = cycle_length - 14
    if day <= period_length:
        return "menstrual"
    if ov - 1 <= day <= ov + 1:
        return "ovulation"
    return "follicular" if day < ov else "luteal"


def mark_for_day(day: int, cycle_length: int, period_length: int) -> str | None:
    ov = cycle_length - 14
    if day <= period_length:
        return "period"
    if day == ov:
        return "ovulation"
    if ov - 5 <= day <= ov + 1:
        return "fertile"
    if day > cycle_length - 5:
        return "pms"
    return None


@dataclass
class Today:
    day: int
    phase: str
    mark: str | None  # period | fertile | ovulation | pms | None
    late_days: int  # >0 — задержка
    next_period: date | None
    next_ovulation: date | None


def today_status(period_days: dict[str, int] | None, settings: dict | None, today: date) -> Today | None:
    """Сегодняшний день цикла — как model.status(today) во фронте"""
    period_days = period_days or {}
    fc = forecast(period_days, settings, today)
    if fc.last_start is None or fc.last_start > today:
        return None
    runs = period_runs(period_days)
    done = [(r[-1] - r[0]).days + 1 for r in runs if len(r) > 1 and r[-1] < today]
    pl = _round(sum(done[-6:]) / len(done[-6:])) if done else int((settings or {}).get("periodLength") or 5)
    day = (today - fc.last_start).days + 1
    cl = fc.cycle_length
    flow = today.isoformat() in period_days
    if flow:
        mark = "period"
    elif day > cl:
        mark = None
    elif day <= pl:
        mark = None  # без отметки прошедшие дни месячных не рисуем
    else:
        mark = mark_for_day(day, cl, pl)
    late = (today - fc.expected).days if fc.expected and fc.late else 0
    return Today(day, phase_for_day(day, cl, pl), mark, late, fc.expected, fc.ovulation)
