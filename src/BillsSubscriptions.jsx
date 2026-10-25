import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadForUser, replaceBills, replaceSubscriptions } from './store/billsSlice.js';
import './receipts.css';
import './bills.css';

const BILL_CATEGORIES = ['Utilities', 'Rent', 'Internet', 'Phone', 'Insurance', 'Other'];
const SUB_CATEGORIES = ['Entertainment', 'Music', 'Fitness', 'Software', 'News', 'Other'];
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'];
const BILL_CYCLES = ['One-time', 'Weekly', 'Monthly', 'Yearly'];
const SUB_CYCLES = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'];
const PAGE_SIZE = 8;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateOkay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};
const dateText = (value) => dateOkay(value) ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Invalid date';
const money = (amount, currency) => {
  try { return Number(amount).toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${Number(amount).toFixed(2)}`; }
};
const blankBill = () => ({ name: '', category: '', amount: '', currency: 'USD', dueDate: today(), frequency: 'Monthly', paid: false, notes: '' });
const blankSub = () => ({ name: '', category: '', price: '', currency: 'USD', cycle: 'Monthly', renewalDate: today(), status: 'Active', paid: false, notes: '' });
const cleanList = (value, isSub) => Array.isArray(value) ? value.filter((x) => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string' && Number.isFinite(Number(isSub ? x.price : x.amount)) && dateOkay(isSub ? x.renewalDate : x.dueDate)) : [];

function Store({ userId, type }) {
  const key = `apexledger_${type}_${userId}`;
  return {
    read() {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      try { return cleanList(JSON.parse(raw), type === 'subscriptions'); }
      catch { return []; }
    },
    write(items) { localStorage.setItem(key, JSON.stringify(items)); },
  };
}

function readFinanceData(userId) {
  const key = `ApexLedger_data_${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return { key, value: { transactions: [], budgets: [], goals: [] } };
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved transaction data is invalid.');
  if (value.transactions !== undefined && !Array.isArray(value.transactions)) throw new Error('Saved transactions are not in the expected format.');
  return { key, value: { ...value, transactions: value.transactions || [], budgets: value.budgets || [], goals: value.goals || [] } };
}

function expenseCategory(item, type) {
  const category = String(item.category || '').toLowerCase();
  if (category === 'rent' || category === 'housing') return 'housing';
  if (['utilities', 'internet', 'phone'].includes(category)) return 'utilities';
  if (category === 'entertainment' || category === 'music') return 'entertainment';
  if (category === 'fitness' || category === 'health') return 'health';
  if (category === 'software' || category === 'news' || category === 'education') return 'education';
  if (category === 'insurance' || category === 'other') return 'other_expense';
  return type === 'subscriptions' ? 'other_expense' : 'other_expense';
}

function applyPaidExpense(finance, type, previous, next) {
  const dateField = type === 'bills' ? 'dueDate' : 'renewalDate';
  const sourceField = type === 'bills' ? 'sourceBillId' : 'sourceSubscriptionId';
  const sourceDateField = type === 'bills' ? 'sourceBillDate' : 'sourceRenewalDate';
  const oldDate = previous?.[dateField];
  const newDate = next?.[dateField];
  const changedDate = previous && oldDate !== newDate;
  const transactions = finance.value.transactions;

  if (previous?.paid && !next.paid && !changedDate) {
    finance.value.transactions = transactions.filter((transaction) => !(transaction?.[sourceField] === next.id && transaction?.[sourceDateField] === oldDate));
    return true;
  }
  if (!next.paid || (previous?.paid && changedDate)) return false;
  if (next.currency !== 'USD') throw new Error('ApexLedger records expenses in USD. Change this item to USD before marking it paid.');
  if (!dateOkay(newDate)) throw new Error('Choose a valid payment or renewal date before marking this item paid.');

  const amount = Number(type === 'bills' ? next.amount : next.price);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A valid positive amount is required to add this expense.');
  const existingIndex = transactions.findIndex((transaction) => transaction?.[sourceField] === next.id && transaction?.[sourceDateField] === newDate);
  const payment = {
    id: existingIndex >= 0 ? transactions[existingIndex].id : `${type}_payment_${next.id}_${newDate}`,
    type: 'expense',
    category: expenseCategory(next, type),
    amount,
    date: newDate,
    account: type === 'bills' ? 'Bill payment' : 'Subscription payment',
    note: `${type === 'bills' ? 'Bill' : 'Subscription'} payment: ${next.name}`,
    [sourceField]: next.id,
    [sourceDateField]: newDate,
  };
  if (existingIndex >= 0) transactions[existingIndex] = payment;
  else transactions.push(payment);
  return true;
}

function Field({ id, label, error, children }) {
  return <div className="rv-field"><label htmlFor={id}>{label}</label>{children}{error && <small className="rv-error">{error}</small>}</div>;
}

function Status({ children, tone }) { return <span className={`bm-status ${tone || ''}`}>{children}</span>; }

export default function BillsSubscriptions({ user }) {
  const userId = String(user?.id ?? user?.email ?? 'guest');
  const dispatch = useDispatch();
  const { bills, subscriptions } = useSelector((state) => state.bills);
  const billsStore = useMemo(() => Store({ userId, type: 'bills' }), [userId]);
  const subsStore = useMemo(() => Store({ userId, type: 'subscriptions' }), [userId]);
  const [tab, setTab] = useState('bills');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blankBill);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState('');
  const notify = (message, error = false) => { setToast({ message, error }); window.setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    try {
      const billRows = billsStore.read();
      const subRows = subsStore.read();
      dispatch(loadForUser({ userId, bills: billRows, subscriptions: subRows })); setLoadError('');
    } catch (error) {
      setLoadError('Browser storage could not be read. Check your browser storage settings and reload.');
      notify(`Could not load bills and subscriptions: ${error.message}`, true);
    }
  }, [billsStore, subsStore, dispatch, userId]);

  const activeSubs = subscriptions.filter((item) => item.status === 'Active');
  const addCosts = (cycle, value) => cycle === 'Weekly' ? value * 52 / 12 : cycle === 'Quarterly' ? value / 3 : cycle === 'Yearly' ? value / 12 : value;
  const totalsByCurrency = (items, field, monthly) => items.reduce((totals, item) => {
    if (item.status && item.status !== 'Active') return totals;
    const amount = monthly ? addCosts(item.cycle, Number(item[field])) : addCosts(item.cycle, Number(item[field])) * 12;
    totals[item.currency] = (totals[item.currency] || 0) + amount;
    return totals;
  }, {});
  const monthlyTotals = totalsByCurrency(activeSubs, 'price', true);
  const yearlyTotals = totalsByCurrency(activeSubs, 'price', false);
  const groupedCosts = (totals) => Object.entries(totals).map(([currency, amount]) => money(amount, currency)).join(' · ') || '—';
  const inSevenDays = (value) => {
    if (!dateOkay(value)) return false;
    const current = new Date(`${today()}T00:00:00`);
    const target = new Date(`${value}T00:00:00`);
    const days = Math.round((target - current) / 86400000);
    return days >= 0 && days <= 7;
  };
  const upcoming = activeSubs.filter((item) => inSevenDays(item.renewalDate)).length + bills.filter((item) => !item.paid && inSevenDays(item.dueDate)).length;
  const activeBills = bills.filter((item) => item.frequency !== 'One-time' || !item.paid).length;
  const rows = tab === 'bills' ? bills : subscriptions;
  const categories = tab === 'bills' ? BILL_CATEGORIES : SUB_CATEGORIES;
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const matches = rows.filter((item) => {
      const itemStatus = tab === 'bills' ? (item.paid ? 'Paid' : 'Unpaid') : item.status;
      return (!q || item.name.toLocaleLowerCase().includes(q)) && (!category || item.category === category) && (!statusFilter || itemStatus === statusFilter);
    });
    matches.sort((a, b) => {
      if (sort === 'amount') return Number(tab === 'bills' ? b.amount : b.price) - Number(tab === 'bills' ? a.amount : a.price);
      if (sort === 'name') return a.name.localeCompare(b.name);
      const ad = tab === 'bills' ? a.dueDate : a.renewalDate;
      const bd = tab === 'bills' ? b.dueDate : b.renewalDate;
      return ad.localeCompare(bd);
    });
    return matches;
  }, [rows, tab, search, category, statusFilter, sort]);
  useEffect(() => { setPage(1); }, [tab, search, category, statusFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveRows = (type, next, paymentChange) => {
    let financeKey = '';
    let previousFinanceRaw = null;
    let financeWasWritten = false;
    try {
      if (paymentChange) {
        const finance = readFinanceData(userId);
        if (applyPaidExpense(finance, type, paymentChange.previous, paymentChange.next)) {
          financeKey = finance.key;
          previousFinanceRaw = localStorage.getItem(financeKey);
          localStorage.setItem(financeKey, JSON.stringify(finance.value));
          financeWasWritten = true;
        }
      }
      (type === 'bills' ? billsStore : subsStore).write(next);
      if (type === 'bills') dispatch(replaceBills({ userId, bills: next }));
      else dispatch(replaceSubscriptions({ userId, subscriptions: next }));
      return true;
    } catch (error) {
      if (financeWasWritten) {
        try {
          if (previousFinanceRaw === null) localStorage.removeItem(financeKey);
          else localStorage.setItem(financeKey, previousFinanceRaw);
        } catch (rollbackError) {}
      }
      notify(`Could not save changes: ${error.message}. Check available browser storage.`, true);
      return false;
    }
  };
  const startAdd = () => { setForm(tab === 'bills' ? blankBill() : blankSub()); setErrors({}); setModal({ type: 'form' }); };
  const startEdit = (item) => { setForm({ ...item }); setErrors({}); setModal({ type: 'form', id: item.id }); };
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    const value = tab === 'bills' ? form.amount : form.price;
    const itemDate = tab === 'bills' ? form.dueDate : form.renewalDate;
    if (!form.name.trim()) nextErrors.name = tab === 'bills' ? 'Enter a bill name.' : 'Enter a service name.';
    if (value === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) nextErrors.amount = 'Enter an amount greater than zero.';
    if (!CURRENCIES.includes(form.currency)) nextErrors.currency = 'Choose a supported currency.';
    if (!categories.includes(form.category)) nextErrors.category = 'Choose a category.';
    if (!dateOkay(itemDate)) nextErrors.date = 'Choose a valid date.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const id = modal.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const current = tab === 'bills' ? bills : subscriptions;
    const previous = current.find((row) => row.id === id) || null;
    const dateChanged = previous && (tab === 'bills' ? previous.dueDate !== itemDate : previous.renewalDate !== itemDate);
    let item;
    if (tab === 'bills') item = { id, name: form.name.trim(), category: form.category, amount: Number(value), currency: form.currency, dueDate: itemDate, frequency: form.frequency, paid: dateChanged && previous.paid ? false : Boolean(form.paid), notes: form.notes.trim() };
    else item = { id, name: form.name.trim(), category: form.category, price: Number(value), currency: form.currency, cycle: form.cycle, renewalDate: itemDate, status: form.status || 'Active', paid: dateChanged && previous.paid ? false : Boolean(form.paid), notes: form.notes.trim() };
    if (saveRows(tab, [item, ...current.filter((row) => row.id !== id)], { previous, next: item })) {
      setModal(null);
      notify(dateChanged && previous?.paid ? 'Date updated. The next payment is unpaid; the earlier expense stays in Transactions.' : modal.id ? 'Changes saved.' : `${tab === 'bills' ? 'Bill' : 'Subscription'} added.`);
    }
  };
  const remove = (item) => {
    const label = tab === 'bills' ? 'bill' : 'subscription';
    if (!window.confirm(`Delete ${label} “${item.name}”?`)) return;
    const current = tab === 'bills' ? bills : subscriptions;
    if (saveRows(tab, current.filter((row) => row.id !== item.id))) { setModal(null); notify(`${label[0].toUpperCase()}${label.slice(1)} deleted.`); }
  };
  const updateItem = (item, patch) => {
    const current = tab === 'bills' ? bills : subscriptions;
    const next = current.map((row) => row.id === item.id ? { ...row, ...patch } : row);
    const updated = next.find((row) => row.id === item.id);
    if (saveRows(tab, next, { previous: item, next: updated })) notify(patch.paid === true ? 'Payment added to Expenses.' : patch.paid === false ? 'Payment removed from Expenses.' : 'Status updated.');
  };
  const clearFilters = () => { setSearch(''); setCategory(''); setStatusFilter(''); setSort('date'); setPage(1); };
  const billState = (bill) => bill.paid ? { label: 'Paid', tone: 'good' } : bill.dueDate < today() ? { label: 'Overdue', tone: 'bad' } : bill.dueDate === today() ? { label: 'Due today', tone: 'soon' } : { label: 'Upcoming', tone: '' };

  return <main className="rv-page bm-page"><div className="rv-shell">
    <header className="rv-top"><Link className="rv-brand" to="/dashboard"><span className="rv-mark"/>ApexLedger</Link><nav aria-label="Main navigation"><Link to="/dashboard">Dashboard</Link><Link to="/receipts">Receipt Vault</Link><span aria-current="page">Bills &amp; Subscriptions</span><Link to="/financial-news">Financial News</Link><Link to="/reports">Reports</Link></nav><div className="rv-user">{user?.firstName || user?.email || 'Your account'}</div></header>
    <section className="rv-heading"><div><div className="rv-kicker">RECURRING FINANCES</div><h1>Bills &amp; Subscriptions</h1><p>Keep upcoming payments and renewals organized.</p></div></section>
    <section className="bm-summary" aria-label="Payment summary">
      <article className="bm-summary-card"><span>Total active bills</span><strong>{activeBills}</strong><small>Across all bill frequencies</small></article>
      <article className="bm-summary-card"><span>Unpaid bills</span><strong>{bills.filter((item) => !item.paid).length}</strong><small>Needs payment tracking</small></article>
      <article className="bm-summary-card"><span>Active subscriptions</span><strong>{activeSubs.length}</strong><small>Paused and cancelled excluded</small></article>
      <article className="bm-summary-card bm-cost"><span>Estimated monthly cost</span><strong>{groupedCosts(monthlyTotals)}</strong><small>Yearly: {groupedCosts(yearlyTotals)}</small></article>
      <article className="bm-summary-card"><span>Due or renewing in 7 days</span><strong>{upcoming}</strong><small>Upcoming unpaid bills and active renewals</small></article>
    </section>
    <section className="bm-panel">
      <div className="bm-tabs" role="tablist" aria-label="Manage bills or subscriptions"><button role="tab" aria-selected={tab === 'bills'} className={tab === 'bills' ? 'selected' : ''} onClick={() => { setTab('bills'); clearFilters(); }}>Bills <span>{bills.length}</span></button><button role="tab" aria-selected={tab === 'subscriptions'} className={tab === 'subscriptions' ? 'selected' : ''} onClick={() => { setTab('subscriptions'); clearFilters(); }}>Subscriptions <span>{subscriptions.length}</span></button></div>
      <div className="bm-toolbar"><label className="rv-search"><span aria-hidden="true">⌕</span><input aria-label={`Search ${tab}`} placeholder={tab === 'bills' ? 'Search bills by name' : 'Search subscriptions by service'} value={search} onChange={(e) => setSearch(e.target.value)}/></label>
        <label className="sr-only" htmlFor="bm-category">Filter category</label><select id="bm-category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="sr-only" htmlFor="bm-status">Filter status</label><select id="bm-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{(tab === 'bills' ? ['Paid', 'Unpaid'] : ['Active', 'Paused', 'Cancelled']).map((item) => <option key={item}>{item}</option>)}</select>
        <label className="sr-only" htmlFor="bm-sort">Sort items</label><select id="bm-sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="date">{tab === 'bills' ? 'Due date' : 'Renewal date'}</option><option value="amount">Amount: high to low</option><option value="name">Name: A to Z</option></select>
        <button className="rv-reset" onClick={clearFilters}>Reset</button><button className="rv-primary bm-add" onClick={startAdd}>＋ Add {tab === 'bills' ? 'Bill' : 'Subscription'}</button>
      </div>
      <div className="rv-count" aria-live="polite">{filtered.length} matching {tab === 'bills' ? 'bills' : 'subscriptions'}</div>
      {loadError && <div className="bm-error-banner" role="alert">{loadError}</div>}
      {shown.length ? <div className="bm-grid">{shown.map((item) => {
        const state = tab === 'bills' ? billState(item) : { label: item.status || 'Active', tone: item.status === 'Active' ? 'good' : item.status === 'Cancelled' ? 'bad' : 'soon' };
        const amount = tab === 'bills' ? item.amount : item.price;
        const when = tab === 'bills' ? item.dueDate : item.renewalDate;
        const period = tab === 'bills' ? item.frequency : item.cycle;
        return <article className="bm-card" key={item.id}><div className="bm-card-top"><div><div className="bm-category">{item.category || 'Other'} · {period}</div><h2>{item.name}</h2></div><div className="bm-badges"><Status tone={state.tone}>{state.label}</Status>{tab === 'subscriptions' && <Status tone={item.paid ? 'good' : ''}>{item.paid ? 'Renewal paid' : 'Renewal unpaid'}</Status>}</div></div><div className="bm-card-info"><span>{tab === 'bills' ? 'Due date' : 'Next renewal'}</span><strong>{dateText(when)}</strong></div><div className="bm-card-amount">{money(amount, item.currency || 'USD')}</div>{item.notes && <p className="bm-notes">{item.notes}</p>}<div className="bm-actions"><button onClick={() => setModal({ type: 'view', item })}>View</button><button onClick={() => startEdit(item)}>Edit</button>{tab === 'bills' ? <button onClick={() => updateItem(item, { paid: !item.paid })}>Mark {item.paid ? 'unpaid' : 'paid'}</button> : <>{item.status === 'Active' ? <button onClick={() => updateItem(item, { status: 'Paused' })}>Pause</button> : item.status === 'Paused' ? <button onClick={() => updateItem(item, { status: 'Active' })}>Resume</button> : null}{item.status !== 'Cancelled' && <button onClick={() => updateItem(item, { paid: !item.paid })}>Mark {item.paid ? 'unpaid' : 'paid'}</button>}{item.status !== 'Cancelled' && <button onClick={() => updateItem(item, { status: 'Cancelled' })}>Cancel</button>}</>}<button className="danger" onClick={() => remove(item)}>Delete</button></div></article>;
      })}</div> : <div className="rv-empty"><div className="rv-empty-icon">{tab === 'bills' ? '◷' : '↻'}</div><h2>{rows.length ? 'No items match these filters' : `No ${tab} added yet`}</h2><p>{rows.length ? 'Try another search or reset the filters.' : tab === 'bills' ? 'Add a bill to track its due date and payment status.' : 'Add subscriptions to estimate recurring costs and renewal dates.'}</p>{rows.length ? <button className="rv-secondary" onClick={clearFilters}>Reset filters</button> : <button className="rv-primary" onClick={startAdd}>＋ Add {tab === 'bills' ? 'Bill' : 'Subscription'}</button>}</div>}
      {filtered.length > PAGE_SIZE && <div className="rv-pagination"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
    </section>
  </div>
  {modal && <div className="rv-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="rv-modal bm-modal" role="dialog" aria-modal="true" aria-labelledby="bm-modal-title"><div className="rv-modal-head"><div><div className="rv-kicker">{tab === 'bills' ? 'BILL DETAILS' : 'SUBSCRIPTION DETAILS'}</div><h2 id="bm-modal-title">{modal.type === 'view' ? modal.item.name : modal.id ? `Edit ${tab === 'bills' ? 'bill' : 'subscription'}` : `Add ${tab === 'bills' ? 'bill' : 'subscription'}`}</h2></div><button className="rv-close" onClick={() => setModal(null)} aria-label="Close dialog">×</button></div>
    {modal.type === 'view' ? <><div className="bm-detail-grid"><span>Category</span><strong>{modal.item.category}</strong><span>{tab === 'bills' ? 'Amount' : 'Price'}</span><strong>{money(tab === 'bills' ? modal.item.amount : modal.item.price, modal.item.currency)}</strong><span>{tab === 'bills' ? 'Due date' : 'Next renewal'}</span><strong>{dateText(tab === 'bills' ? modal.item.dueDate : modal.item.renewalDate)}</strong><span>{tab === 'bills' ? 'Frequency' : 'Billing cycle'}</span><strong>{tab === 'bills' ? modal.item.frequency : modal.item.cycle}</strong><span>Status</span><strong>{tab === 'bills' ? billState(modal.item).label : modal.item.status}</strong><span>Payment</span><strong>{modal.item.paid ? 'Paid · recorded in Expenses' : 'Unpaid'}</strong></div>{modal.item.notes && <p className="bm-view-notes">{modal.item.notes}</p>}<div className="rv-modal-actions"><button className="rv-secondary" onClick={() => setModal(null)}>Close</button><button className="rv-primary" onClick={() => startEdit(modal.item)}>Edit</button></div></> : <form onSubmit={submit} noValidate><div className="bm-payment-hint">Marking paid adds an expense dated on the due or renewal date. Transaction amounts use USD. If you move a paid item to a new cycle, its earlier expense stays in Transactions.</div>
      <Field id="bm-name" label={tab === 'bills' ? 'Bill name' : 'Service name'} error={errors.name}><input id="bm-name" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tab === 'bills' ? 'e.g. Electricity' : 'e.g. Music plan'} autoFocus/></Field>
      <div className="rv-form-grid"><Field id="bm-category-form" label="Category" error={errors.category}><select id="bm-category-form" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Choose a category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field><Field id="bm-amount" label={`Amount (${form.currency})`} error={errors.amount}><input id="bm-amount" type="number" min="0.01" step="0.01" value={tab === 'bills' ? form.amount : form.price} onChange={(e) => setForm({ ...form, [tab === 'bills' ? 'amount' : 'price']: e.target.value })} placeholder="0.00"/></Field></div>
      <div className="rv-form-grid"><Field id="bm-currency" label="Currency" error={errors.currency}><select id="bm-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field id="bm-date" label={tab === 'bills' ? 'Due date' : 'Next renewal date'} error={errors.date}><input id="bm-date" type="date" value={tab === 'bills' ? form.dueDate : form.renewalDate} onChange={(e) => setForm({ ...form, [tab === 'bills' ? 'dueDate' : 'renewalDate']: e.target.value })}/></Field></div>
      <Field id="bm-cycle" label={tab === 'bills' ? 'Frequency' : 'Billing cycle'}>{tab === 'bills' ? <select id="bm-cycle" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>{BILL_CYCLES.map((item) => <option key={item}>{item}</option>)}</select> : <select id="bm-cycle" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })}>{SUB_CYCLES.map((item) => <option key={item}>{item}</option>)}</select>}</Field>
      {tab === 'bills' ? <Field id="bm-paid" label="Payment status"><select id="bm-paid" value={String(Boolean(form.paid))} onChange={(e) => setForm({ ...form, paid: e.target.value === 'true' })}><option value="false">Unpaid</option><option value="true">Paid</option></select></Field> : <><Field id="bm-sub-status" label="Subscription status"><select id="bm-sub-status" value={form.status || 'Active'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Paused</option><option>Cancelled</option></select></Field><Field id="bm-sub-paid" label="Renewal payment status"><select id="bm-sub-paid" value={String(Boolean(form.paid))} onChange={(e) => setForm({ ...form, paid: e.target.value === 'true' })}><option value="false">Unpaid</option><option value="true">Paid</option></select></Field></>}
      <Field id="bm-notes" label="Notes (optional)"><textarea id="bm-notes" rows="3" maxLength={500} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes"/></Field>
      <div className="rv-modal-actions"><button type="button" className="rv-secondary" onClick={() => setModal(null)}>Cancel</button><button className="rv-primary" type="submit">{modal.id ? 'Save changes' : 'Save item'}</button></div>
    </form>}</section></div>}
  {toast && <div className={`rv-toast ${toast.error ? 'is-error' : ''}`} role="status"><span/>{toast.message}</div>}
  </main>;
}
