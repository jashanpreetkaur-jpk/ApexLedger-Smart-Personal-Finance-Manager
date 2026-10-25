import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './receipts.css';
import './reports.css';

const CATEGORY_NAMES = {
  housing: 'Housing', food: 'Food & Dining', transport: 'Transport', shopping: 'Shopping',
  utilities: 'Utilities', health: 'Health', entertainment: 'Entertainment', travel: 'Travel',
  education: 'Education', other_expense: 'Other', salary: 'Salary', freelance: 'Freelance',
  investment: 'Investment', gift: 'Gift', business: 'Business', other_income: 'Other income',
};
const localISODate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const formatDate = (value) => validDate(value) ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Invalid date';
const formatMoney = (amount) => Number(amount || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const categoryName = (category) => CATEGORY_NAMES[category] || category || 'Uncategorized';

function getUserData(userId) {
  const raw = localStorage.getItem(`ApexLedger_data_${userId}`);
  if (!raw) return { transactions: [], budgets: [], goals: [] };
  const parsed = JSON.parse(raw);
  return {
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions.filter((item) => item && validDate(item.date) && Number.isFinite(Number(item.amount)) && (item.type === 'income' || item.type === 'expense')) : [],
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets.filter((item) => item && typeof item.category === 'string' && Number.isFinite(Number(item.limit)) && Number(item.limit) > 0) : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals.filter((item) => item && typeof item.name === 'string') : [],
  };
}

function makeSummarySheet(data) {
  return [
    ['ApexLedger Financial Report'],
    ['Selected period', `${data.start} to ${data.end}`],
    ['Total income', data.income], ['Total expenses', data.expenses], ['Net', data.income - data.expenses],
    [], ['Current month budgets'], ['Category', 'Spent this month', 'Budget limit', 'Remaining'],
    ...data.budgets.map((item) => [categoryName(item.category), item.spent, Number(item.limit), Number(item.limit) - item.spent]),
    [], ['Savings goals'], ['Goal', 'Saved', 'Target', 'Progress'],
    ...data.goals.map((item) => [item.name, Number(item.current) || 0, Number(item.target) || 0, item.progress]),
  ];
}

async function exportExcel(data) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ApexLedger';
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRows(makeSummarySheet(data));
  const transactionSheet = workbook.addWorksheet('Transactions');
  transactionSheet.addRow(['Date', 'Type', 'Category', 'Amount', 'Account', 'Note']);
  data.transactions.forEach((item) => transactionSheet.addRow([
    item.date, item.type, categoryName(item.category), Number(item.amount), item.account || '', item.note || '',
  ]));
  const categorySheet = workbook.addWorksheet('Category Breakdown');
  categorySheet.addRow(['Category', 'Income', 'Expenses']);
  data.categories.forEach((item) => categorySheet.addRow([item.category, item.income, item.expenses]));
  summarySheet.columns = [{ width: 34 }, { width: 24 }, { width: 22 }, { width: 18 }];
  transactionSheet.columns = [{ width: 14 }, { width: 14 }, { width: 22 }, { width: 16 }, { width: 18 }, { width: 36 }];
  categorySheet.columns = [{ width: 26 }, { width: 18 }, { width: 18 }];
  [summarySheet, transactionSheet, categorySheet].forEach((sheet) => { sheet.getRow(1).font = { bold: true }; });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `apexledger-report-${data.start}-to-${data.end}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPDF(data) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 14;
  const maxWidth = pageWidth - left * 2;
  let y = 18;
  const ensureSpace = (height) => { if (y + height > pageHeight - 14) { pdf.addPage(); y = 18; } };
  const heading = (title) => {
    ensureSpace(12); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text(title, left, y); y += 8;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  };
  const line = (text) => {
    const wrapped = pdf.splitTextToSize(String(text), maxWidth);
    ensureSpace(wrapped.length * 5 + 1); pdf.text(wrapped, left, y); y += wrapped.length * 5 + 1;
  };

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('ApexLedger Financial Report', left, y); y += 8;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); line(`Period: ${formatDate(data.start)} – ${formatDate(data.end)}`);
  line(`Total income: ${formatMoney(data.income)}   |   Total expenses: ${formatMoney(data.expenses)}   |   Net: ${formatMoney(data.income - data.expenses)}`);
  heading('Transactions');
  if (!data.transactions.length) line('No transactions in the selected date range.');
  data.transactions.forEach((item) => line(`${formatDate(item.date)} | ${item.type} | ${categoryName(item.category)} | ${formatMoney(item.amount)} | ${item.account || ''} ${item.note || ''}`));
  heading('Category breakdown');
  if (!data.categories.length) line('No category totals for this period.');
  data.categories.forEach((item) => line(`${item.category}: income ${formatMoney(item.income)} | expenses ${formatMoney(item.expenses)}`));
  heading('Current month budgets');
  if (!data.budgets.length) line('No budgets are set.');
  data.budgets.forEach((item) => line(`${categoryName(item.category)}: spent ${formatMoney(item.spent)} of ${formatMoney(item.limit)}; remaining ${formatMoney(Number(item.limit) - item.spent)}`));
  heading('Savings goals');
  if (!data.goals.length) line('No savings goals are set.');
  data.goals.forEach((item) => line(`${item.name}: ${formatMoney(item.current)} of ${formatMoney(item.target)} (${item.progress}%)${item.deadline ? `; target date ${formatDate(item.deadline)}` : ''}`));
  pdf.save(`apexledger-report-${data.start}-to-${data.end}.pdf`);
}

export default function Reports({ user }) {
  const userId = String(user?.id ?? user?.email ?? 'guest');
  const now = new Date();
  const [start, setStart] = useState(localISODate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [end, setEnd] = useState(localISODate(now));
  const [data, setData] = useState({ transactions: [], budgets: [], goals: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);
  const [rangeTouched, setRangeTouched] = useState(false);
  const notify = (message, isError = false) => { setToast({ message, isError }); window.setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    setLoading(true);
    try { setData(getUserData(userId)); setLoadError(''); }
    catch (error) { setData({ transactions: [], budgets: [], goals: [] }); setLoadError(`Could not read saved ApexLedger data: ${error.message}`); }
    finally { setLoading(false); }
  }, [userId]);

  const dateError = !validDate(start) || !validDate(end) ? 'Choose valid start and end dates.' : start > end ? 'Start date must be on or before the end date.' : '';
  const report = useMemo(() => {
    if (dateError) return { transactions: [], income: 0, expenses: 0, categories: [], budgets: [], goals: [] };
    const transactions = data.transactions.filter((item) => item.date >= start && item.date <= end).slice().sort((a, b) => a.date.localeCompare(b.date));
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
    const byCategory = {};
    transactions.forEach((item) => {
      const label = categoryName(item.category);
      if (!byCategory[label]) byCategory[label] = { category: label, income: 0, expenses: 0 };
      byCategory[label][item.type] += Number(item.amount);
    });
    const monthKey = localISODate(new Date()).slice(0, 7);
    const budgets = data.budgets.map((item) => ({
      ...item,
      spent: data.transactions.filter((txn) => txn.type === 'expense' && txn.category === item.category && validDate(txn.date) && txn.date.slice(0, 7) === monthKey).reduce((sum, txn) => sum + Number(txn.amount), 0),
    }));
    const goals = data.goals.map((item) => {
      const target = Number(item.target) || 0;
      const current = Number(item.current) || 0;
      return { ...item, target, current, progress: target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0 };
    });
    return { start, end, transactions, income, expenses, categories: Object.values(byCategory).sort((a, b) => a.category.localeCompare(b.category)), budgets, goals };
  }, [data, start, end, dateError]);

  const download = async (type) => {
    setRangeTouched(true);
    if (dateError) return;
    try { if (type === 'excel') await exportExcel(report); else await exportPDF(report); notify(`${type === 'excel' ? 'Excel' : 'PDF'} report downloaded.`); }
    catch (error) { notify(`Could not create the report: ${error.message}`, true); }
  };

  return <main className="rv-page rp-page"><div className="rv-shell">
    <header className="rv-top"><Link className="rv-brand" to="/dashboard"><span className="rv-mark"/>ApexLedger</Link><nav aria-label="Main navigation"><Link to="/dashboard">Dashboard</Link><Link to="/receipts">Receipt Vault</Link><Link to="/bills-subscriptions">Bills &amp; Subscriptions</Link><Link to="/financial-news">Financial News</Link><span aria-current="page">Reports</span></nav><div className="rv-user">{user?.firstName || user?.email || 'Your account'}</div></header>
    <section className="rv-heading"><div><div className="rv-kicker">YOUR FINANCIAL OVERVIEW</div><h1>Reports</h1><p>Review your saved activity and export a report for any period.</p></div></section>
    <section className="rp-filter card static"><div className="rp-dates"><label htmlFor="rp-start">Start date<input id="rp-start" type="date" value={start} onChange={(event) => { setStart(event.target.value); setRangeTouched(true); }}/></label><label htmlFor="rp-end">End date<input id="rp-end" type="date" value={end} onChange={(event) => { setEnd(event.target.value); setRangeTouched(true); }}/></label></div>{rangeTouched && dateError && <p className="rp-error" role="alert">{dateError}</p>}<div className="rp-buttons"><button className="rv-primary" disabled={Boolean(dateError) || loading} onClick={() => download('excel')}>Export Excel</button><button className="rv-secondary" disabled={Boolean(dateError) || loading} onClick={() => download('pdf')}>Export PDF</button></div></section>
    {loading ? <div className="rv-empty" role="status">Loading saved financial data…</div> : loadError ? <div className="rp-error-card" role="alert">{loadError}</div> : <>
      <section className="rp-totals"><article><span>Total income</span><strong>{formatMoney(report.income)}</strong></article><article><span>Total expenses</span><strong>{formatMoney(report.expenses)}</strong></article><article><span>Net</span><strong>{formatMoney(report.income - report.expenses)}</strong></article><article><span>Transactions</span><strong>{report.transactions.length}</strong></article></section>
      {!report.transactions.length && <div className="rv-empty rp-empty"><h2>No transactions in this period</h2><p>Try another date range. Reports include your current budgets and savings goals even when the transaction period is empty.</p></div>}
      <section className="rp-section card static"><div className="card-head"><div><div className="card-title">Transaction details</div><div className="card-sub">{report.transactions.length} records from {formatDate(start)} to {formatDate(end)}</div></div></div>{report.transactions.length ? <div className="rp-table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Account</th><th>Note</th><th>Amount</th></tr></thead><tbody>{report.transactions.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td className={item.type === 'income' ? 'rp-income' : 'rp-expense'}>{item.type}</td><td>{categoryName(item.category)}</td><td>{item.account || '—'}</td><td>{item.note || '—'}</td><td>{formatMoney(item.amount)}</td></tr>)}</tbody></table></div> : <p className="rp-muted">No transaction details to show for this period.</p>}</section>
      <div className="rp-two-col"><section className="rp-section card static"><div className="card-head"><div><div className="card-title">Category breakdown</div><div className="card-sub">Income and expenses in selected period</div></div></div>{report.categories.length ? <div className="rp-table-wrap"><table><thead><tr><th>Category</th><th>Income</th><th>Expenses</th></tr></thead><tbody>{report.categories.map((item) => <tr key={item.category}><td>{item.category}</td><td className="rp-income">{formatMoney(item.income)}</td><td className="rp-expense">{formatMoney(item.expenses)}</td></tr>)}</tbody></table></div> : <p className="rp-muted">No category totals for this period.</p>}</section>
        <section className="rp-section card static"><div className="card-head"><div><div className="card-title">Current budgets</div><div className="card-sub">Spending this month</div></div></div>{report.budgets.length ? <div className="rp-list">{report.budgets.map((item) => <div className="rp-row" key={item.id}><span>{categoryName(item.category)}</span><strong>{formatMoney(item.spent)} <small>of {formatMoney(item.limit)}</small></strong><div className="rp-progress"><i style={{ width: `${Math.min(100, Math.round(item.spent / item.limit * 100))}%` }}/></div></div>)}</div> : <p className="rp-muted">No budgets are set.</p>}</section></div>
      <section className="rp-section card static"><div className="card-head"><div><div className="card-title">Savings goals</div><div className="card-sub">Current progress</div></div></div>{report.goals.length ? <div className="rp-goals">{report.goals.map((item) => <div className="rp-goal" key={item.id || item.name}><div><strong>{item.name}</strong><span>{item.progress}% · {formatMoney(item.current)} of {formatMoney(item.target)}</span></div>{item.deadline && <small>Target: {formatDate(item.deadline)}</small>}<div className="rp-progress"><i style={{ width: `${item.progress}%` }}/></div></div>)}</div> : <p className="rp-muted">No savings goals are set.</p>}</section>
    </>}
  </div>{toast && <div className={`rv-toast ${toast.isError ? 'is-error' : ''}`} role="status"><span/>{toast.message}</div>}</main>;
}
