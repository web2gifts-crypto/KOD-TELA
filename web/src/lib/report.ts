// Отчёт «Мой код тела» — один HTML-файл, который открывается на любом устройстве
// и печатается в PDF. Удобно показать врачу. На этапе бэкенда бот пришлёт его в чат.

import { formatDay, today as todayISO } from './date'
import { cycleStats, labTrends, moodStats, symptomStats } from './stats'
import { MARKS, PHASES } from './cycle'
import type { AppData } from '../store/app'

const MOOD_NAMES = ['Плохо', 'Тревожно', 'Нейтрально', 'Хорошо', 'Отлично']

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function buildReport(d: AppData): { filename: string; html: string } {
  const today = todayISO()
  const cs = cycleStats(d.periodStarts)
  const ms = moodStats(d.moods, d.moodNotes)
  const ss = symptomStats(d.symptoms, d.periodStarts, d.cycle)
  const lt = labTrends(d.labs)

  const row = (k: string, v: string) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`
  const cycleRows = [
    row('Отмечено начал месячных', String(cs.tracked)),
    row('Средняя длина цикла', cs.avg ? `${cs.avg} дн. (от ${cs.min} до ${cs.max})` : 'нужно минимум 2 цикла'),
    row('Длина месячных (настройка)', `${d.cycle.periodLength} дн.`),
    row('Регулярность', cs.regular === null ? 'недостаточно данных' : cs.regular ? 'регулярный (разброс ≤ 7 дн.)' : 'нерегулярный'),
    row('Последние месячные', d.cycle.lastPeriodStart ? formatDay(d.cycle.lastPeriodStart, true) : '—'),
  ].join('')

  const moodRows = ms.total
    ? [
        row('Отметок настроения', String(ms.total)),
        ...ms.counts.map((c, i) => row(MOOD_NAMES[i], `${c} (${Math.round((c / ms.total) * 100)}%)`)).reverse(),
        row('Лучшая серия', `${ms.bestStreak} дн. подряд`),
        row('Чаще всего влияет', ms.factors.slice(0, 3).map((f) => esc(f.name)).join(', ') || '—'),
      ].join('')
    : row('Отметок настроения', 'пока нет')

  const symptomRows = ss.length
    ? ss.map((s) => row(esc(s.name), `${s.count} раз${s.phase ? ` · чаще: ${PHASES[s.phase].name.toLowerCase()}` : ''}`)).join('')
    : row('Симптомы', 'не отмечались')

  const labRows = lt.length
    ? lt
        .map(({ ev, prev }) => {
          const st = { ok: 'норма', warn: 'внимание', bad: ev.direction === 'low' ? 'ниже нормы' : 'выше нормы' }[ev.status]
          return `<tr><td>${ev.def.name}</td><td><b>${ev.value} ${ev.def.unit}</b>${prev !== null ? ` <span class="m">(было ${prev})</span>` : ''}</td><td>${ev.def.min}–${ev.def.max}</td><td class="${ev.status}">${st}</td></tr>`
        })
        .join('')
    : '<tr><td colspan="4">Анализы не загружались</td></tr>'

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Мой код тела — ${formatDay(today, true)}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1b4b;max-width:720px;margin:0 auto;padding:24px;background:#fff}
h1{margin:0;font-size:26px;color:#5b63ee}h2{font-size:17px;margin:28px 0 8px;color:#7b6cf6}
.sub{color:#8986a8;margin:4px 0 0}table{width:100%;border-collapse:collapse;font-size:14px}
td{padding:8px 6px;border-bottom:1px solid #ebe9fa;vertical-align:top}.m{color:#8986a8;font-weight:400}
.ok{color:#34b37a}.warn{color:#d18a1c}.bad{color:#e8566c}
.note{margin-top:28px;padding:12px 14px;border-radius:12px;background:#f4f3ff;color:#6b6890;font-size:13px}
@media print{body{padding:0}}
</style></head><body>
<h1>Мой код тела</h1>
<p class="sub">${esc(d.profile?.name ?? '')}${d.profile?.age ? `, ${d.profile.age} лет` : ''} · сформировано ${formatDay(today, true)} в приложении «Код Тела»</p>
<h2>Цикл</h2><table>${cycleRows}</table>
<p class="sub">Разметка календаря: ${Object.values(MARKS).map((m) => m.label.toLowerCase()).join(', ')} — по прогнозу приложения.</p>
<h2>Настроение</h2><table>${moodRows}</table>
<h2>Симптомы</h2><table>${symptomRows}</table>
<h2>Анализы (последние значения)</h2><table><tr><td class="m">Показатель</td><td class="m">Значение</td><td class="m">Норма</td><td class="m">Статус</td></tr>${labRows}</table>
<div class="note">Отчёт сформирован автоматически по данным, которые вы внесли. Это не медицинское заключение и не заменяет консультацию врача.</div>
</body></html>`

  return { filename: `kod-tela-${today}.html`, html }
}
