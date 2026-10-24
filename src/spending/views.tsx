import { useRef, useState, type FormEvent } from 'react';
import type { Appearance } from '../shared/appearance';
import { DraftInput } from '../shared/components/DraftInput';
import { addDays, fmtDate, fmtRangeShort, monthLabel, parseDate, shiftMonth, todayISO, weekdayShort } from '../shared/dates';
import { fmtMoney, num } from '../shared/format';
import { BarChart } from './BarChart';
import { calendarCells, dayTotal, expensesOnDate, monthSummary, totalOf, weekSummary, yearSummary, type ExpensesMap } from './derive';
import { spendingStore } from './store';

type Nav = { onPrev: () => void; onNext: () => void; onToday: () => void };

function PeriodNav({ label, unit, todayText, labelId, nav }: { label: string; unit: string; todayText: string; labelId: string; nav: Nav }) {
  return (
    <div className="period-nav">
      <button className="nav-arrow" title={'Previous ' + unit} onClick={nav.onPrev}><i className="bi bi-chevron-left"></i></button>
      <div id={labelId} className="period-label">{label}</div>
      <button className="nav-arrow" title={'Next ' + unit} onClick={nav.onNext}><i className="bi bi-chevron-right"></i></button>
      <button className="btn btn-ghost btn-sm" onClick={nav.onToday}>{todayText}</button>
    </div>
  );
}

function Stat({ icon, label, value, id, small }: { icon: string; label: string; value: string; id?: string; small?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label"><i className={'bi ' + icon}></i>{label}</div>
      <div className="stat-value" id={id} style={small ? { fontSize: '1.05rem' } : undefined}>{value}</div>
    </div>
  );
}

/* ---------------- Day ---------------- */

export function DayView({ expenses, date, setDate, ready }: { expenses: ExpensesMap; date: string; setDate: (d: string) => void; ready: boolean }) {
  const list = expensesOnDate(expenses, date);
  const total = totalOf(list);
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const itemRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = item.trim();
    const p = num(price);
    if (!name) { itemRef.current?.focus(); return; }
    if (p === null || p < 0) { priceRef.current?.focus(); return; }
    spendingStore.addExpense(date, name, p);
    setItem(''); setPrice('');
    itemRef.current?.focus();
  };

  return (
    <div id="pageDay" className="page">
      <div className="day-nav">
        <button className="nav-arrow" id="dayPrev" title="Previous day" onClick={() => setDate(addDays(date, -1))}><i className="bi bi-chevron-left"></i></button>
        <div className="day-nav-date">
          <div id="dayDateBig" className="day-date-big">{ready ? fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}</div>
          <div id="dayDateSub" className="day-date-sub">{ready ? String(parseDate(date)!.getFullYear()) : '—'}</div>
        </div>
        <button className="nav-arrow" id="dayNext" title="Next day" onClick={() => setDate(addDays(date, 1))}><i className="bi bi-chevron-right"></i></button>
        {ready && date !== todayISO() && <button className="btn btn-ghost btn-sm" id="dayTodayBtn" onClick={() => setDate(todayISO())}>Today</button>}
      </div>

      <section className="stats">
        <Stat icon="bi-cash-coin" label="Total spent" id="dayTotal" value={fmtMoney(ready ? total : 0)} />
        <Stat icon="bi-receipt" label="Items" id="dayCount" value={String(ready ? list.length : 0)} />
        <Stat icon="bi-graph-up" label="Avg / item" id="dayAvgItem" value={ready && list.length ? fmtMoney(total / list.length) : '—'} />
      </section>

      <section className="card-x mt-3">
        <div className="card-x-head">
          <h2 className="card-x-title"><i className="bi bi-plus-circle"></i>Expenses</h2>
        </div>
        <div className="card-x-body">
          <form id="addForm" className="add-row" onSubmit={add}>
            <input id="addItem" ref={itemRef} type="text" placeholder="Item name…" autoComplete="off" required value={item} onChange={e => setItem(e.target.value)} />
            <div className="exp-price-wrap">
              <span className="exp-prefix">₱</span>
              <input id="addPrice" ref={priceRef} type="number" step="0.01" min="0" placeholder="0.00" required value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary-x"><i className="bi bi-plus-lg me-1"></i>Add</button>
          </form>

          {ready && !list.length && (
            <div id="dayEmpty" className="empty fade-in mt-3">
              <div className="empty-icon"><i className="bi bi-receipt"></i></div>
              <h3>No expenses yet</h3>
              <p>Add what you spent today above — item name and price.</p>
            </div>
          )}

          <div id="dayList" className="exp-list mt-3">
            {ready && list.map(e => (
              <div className="exp-row" data-id={e.id} key={e.id}>
                <DraftInput className="exp-item-input" data-field="item" placeholder="Item" value={e.item}
                  onValue={t => spendingStore.setField(e.id!, 'item', t)} onBlur={spendingStore.flushSaves} />
                <div className="exp-price-wrap"><span className="exp-prefix">₱</span>
                  <DraftInput className="exp-price-input" data-field="price" type="number" step="0.01" min="0"
                    value={e.price != null ? String(e.price) : ''}
                    onValue={t => spendingStore.setField(e.id!, 'price', num(t) || 0)} onBlur={spendingStore.flushSaves} />
                </div>
                <button type="button" className="btn-trash" title="Delete" onClick={() => spendingStore.deleteExpense(e.id!)}><i className="bi bi-trash3"></i></button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Calendar ---------------- */

export function CalendarView({ expenses, ym, setYm, onPickDay }: { expenses: ExpensesMap; ym: string; setYm: (v: string) => void; onPickDay: (d: string) => void }) {
  const today = todayISO();
  const s = monthSummary(expenses, ym, today);
  return (
    <div id="pageCalendar" className="page">
      <PeriodNav label={monthLabel(ym)} labelId="calLabel" unit="month" todayText="This month"
        nav={{ onPrev: () => setYm(shiftMonth(ym, -1)), onNext: () => setYm(shiftMonth(ym, 1)), onToday: () => setYm(today.slice(0, 7)) }} />
      <section className="stats">
        <Stat icon="bi-cash-coin" label="Month total" id="calTotal" value={fmtMoney(s.total)} />
        <Stat icon="bi-graph-up" label="Avg / day" id="calAvg" value={fmtMoney(s.avgPerDay)} />
      </section>
      <section className="card-x mt-3">
        <div className="card-x-body">
          <div className="cal-head-row">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
          <div id="calGrid" className="cal-grid">
            {calendarCells(ym).map((d, i) => {
              if (d === null) return <div className="cal-cell empty" key={'e' + i}></div>;
              const iso = ym + '-' + String(d).padStart(2, '0');
              const total = dayTotal(expenses, iso);
              const cls = 'cal-cell' + (iso === today ? ' today' : '') + (total > 0 ? ' has-spend' : '');
              return (
                <div className={cls} data-date={iso} key={iso} onClick={() => onPickDay(iso)}>
                  <div className="cal-day-num">{d}</div>
                  {total > 0 && <div className="cal-day-total">{fmtMoney(total)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Week ---------------- */

export function WeekView({ expenses, anchor, setAnchor, onPickDay, appearance }: {
  expenses: ExpensesMap; anchor: string; setAnchor: (v: string) => void; onPickDay: (d: string) => void; appearance: Appearance;
}) {
  const today = todayISO();
  const s = weekSummary(expenses, anchor, today);
  return (
    <div id="pageWeek" className="page">
      <PeriodNav label={fmtRangeShort(s.start, s.end)} labelId="weekLabel" unit="week" todayText="This week"
        nav={{ onPrev: () => setAnchor(addDays(anchor, -7)), onNext: () => setAnchor(addDays(anchor, 7)), onToday: () => setAnchor(today) }} />
      <section className="stats">
        <Stat icon="bi-cash-coin" label="Week total" id="weekTotal" value={fmtMoney(s.total)} />
        <Stat icon="bi-graph-up" label="Avg / day" id="weekAvg" value={fmtMoney(s.avgPerDay)} />
        <Stat icon="bi-arrow-up-circle" label="Highest day" id="weekHigh" small
          value={s.highest ? weekdayShort(s.highest.date) + ' · ' + fmtMoney(s.highest.total) : '—'} />
      </section>
      <section className="card-x mt-3">
        <div className="card-x-head"><h2 className="card-x-title"><i className="bi bi-bar-chart-line"></i>Daily breakdown</h2></div>
        <div className="card-x-body">
          <BarChart id="weekChartCanvas" labels={s.days.map(weekdayShort)} data={s.totals} appearance={appearance} />
          <div id="weekList" className="list-rows mt-3">
            {s.days.map((d, i) => (
              <div className={'list-row' + (d === today ? ' is-today' : '')} data-date={d} key={d} onClick={() => onPickDay(d)}>
                <span className="list-row-label">{parseDate(d)!.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span className="list-row-val">{fmtMoney(s.totals[i])}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Month ---------------- */

export function MonthView({ expenses, ym, setYm, appearance }: { expenses: ExpensesMap; ym: string; setYm: (v: string) => void; appearance: Appearance }) {
  const today = todayISO();
  const s = monthSummary(expenses, ym, today);
  return (
    <div id="pageMonth" className="page">
      <PeriodNav label={monthLabel(ym)} labelId="monthLabel" unit="month" todayText="This month"
        nav={{ onPrev: () => setYm(shiftMonth(ym, -1)), onNext: () => setYm(shiftMonth(ym, 1)), onToday: () => setYm(today.slice(0, 7)) }} />
      <section className="stats">
        <Stat icon="bi-cash-coin" label="Month total" id="monthTotal" value={fmtMoney(s.total)} />
        <Stat icon="bi-graph-up" label="Avg / day" id="monthAvg" value={fmtMoney(s.avgPerDay)} />
        <Stat icon="bi-calendar-check" label="Days tracked" id="monthTracked" value={s.trackedDays + ' / ' + s.dim} />
        <Stat icon="bi-arrow-up-circle" label="Highest day" id="monthHigh" small
          value={s.highest ? 'Day ' + s.highest.day + ' · ' + fmtMoney(s.highest.total) : '—'} />
      </section>
      <section className="card-x mt-3">
        <div className="card-x-head"><h2 className="card-x-title"><i className="bi bi-bar-chart-line"></i>Daily breakdown</h2></div>
        <div className="card-x-body">
          <BarChart id="monthChartCanvas" labels={s.days.map((_, i) => String(i + 1))} data={s.totals} appearance={appearance} />
        </div>
      </section>
    </div>
  );
}

/* ---------------- Year ---------------- */

export function YearView({ expenses, year, setYear, onPickMonth, appearance }: {
  expenses: ExpensesMap; year: string; setYear: (v: string) => void; onPickMonth: (ym: string) => void; appearance: Appearance;
}) {
  const today = todayISO();
  const s = yearSummary(expenses, year, today);
  const monthName = (i: number, month: 'short' | 'long') => new Date(Number(year), i, 1).toLocaleDateString(undefined, { month });
  return (
    <div id="pageYear" className="page">
      <PeriodNav label={year} labelId="yearLabel" unit="year" todayText="This year"
        nav={{ onPrev: () => setYear(String(Number(year) - 1)), onNext: () => setYear(String(Number(year) + 1)), onToday: () => setYear(today.slice(0, 4)) }} />
      <section className="stats">
        <Stat icon="bi-cash-coin" label="Year total" id="yearTotal" value={fmtMoney(s.total)} />
        <Stat icon="bi-graph-up" label="Avg / month" id="yearAvgMonth" value={fmtMoney(s.avgPerMonth)} />
        <Stat icon="bi-graph-up" label="Avg / day" id="yearAvgDay" value={fmtMoney(s.avgPerDay)} />
      </section>
      <section className="card-x mt-3">
        <div className="card-x-head"><h2 className="card-x-title"><i className="bi bi-bar-chart-line"></i>Monthly breakdown</h2></div>
        <div className="card-x-body">
          <BarChart id="yearChartCanvas" labels={s.months.map((_, i) => monthName(i, 'short'))} data={s.totals} appearance={appearance} />
          <div id="yearList" className="list-rows mt-3">
            {s.months.map((ym, i) => (
              <div className="list-row" data-month={ym} key={ym} onClick={() => onPickMonth(ym)}>
                <span className="list-row-label">{monthName(i, 'long')}</span>
                <span className="list-row-val">{fmtMoney(s.totals[i])}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
