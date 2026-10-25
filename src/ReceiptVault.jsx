import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './receipts.css';

const CATEGORIES = ['Housing', 'Food & Dining', 'Transport', 'Shopping', 'Utilities', 'Health', 'Entertainment', 'Travel', 'Education', 'Other'];
const DB_NAME = 'apexledger_receipts';
const STORE = 'receipts';
const LIMIT = 5 * 1024 * 1024;
const blank = () => ({ title: '', amount: '', date: new Date().toISOString().slice(0, 10), category: '', notes: '', image: null });
const dateLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is unavailable in this browser.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
  });
}
async function allReceipts(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result || []).filter((item) => item.userId === userId && item && typeof item.title === 'string' && Number.isFinite(Number(item.amount)) && item.image instanceof Blob));
    request.onerror = () => reject(request.error || new Error('Could not read saved receipts.'));
  });
}
async function writeReceipt(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(item);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error || new Error('Could not save receipt.'));
  });
}
async function removeReceipt(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error || new Error('Could not delete receipt.'));
  });
}

function Field({ label, id, error, children }) { return <div className="rv-field"><label htmlFor={id}>{label}</label>{children}{error && <small className="rv-error">{error}</small>}</div>; }

export default function ReceiptVault({ user }) {
  const [receipts, setReceipts] = useState([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileRef = useRef(null);
  const imageUrls = useRef(new Map());
  const toastTimer = useRef(null);
  const userId = String(user?.id ?? user?.email ?? 'guest');

  const notify = (message, error = false) => { setToast({ message, error }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3200); };
  const getImageUrl = (item) => {
    if (!imageUrls.current.has(item.id)) imageUrls.current.set(item.id, URL.createObjectURL(item.image));
    return imageUrls.current.get(item.id);
  };
  const refresh = async () => { setBusy(true); try { setReceipts(await allReceipts(userId)); } catch (e) { notify(`${e.message} Your receipts could not be loaded.`, true); } finally { setBusy(false); } };
  useEffect(() => { refresh(); return () => { imageUrls.current.forEach(URL.revokeObjectURL); clearTimeout(toastTimer.current); }; }, [userId]);
  useEffect(() => { setPreviewUrl(form.image ? URL.createObjectURL(form.image) : ''); return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [form.image]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = receipts.filter((r) => (!q || r.title.toLocaleLowerCase().includes(q)) && (!category || r.category === category) && (!from || r.date >= from) && (!to || r.date <= to));
    rows.sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) : sort === 'highest' ? b.amount - a.amount : sort === 'lowest' ? a.amount - b.amount : b.date.localeCompare(a.date));
    return rows;
  }, [receipts, search, category, from, to, sort]);
  useEffect(() => setPage(1), [search, category, from, to, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8));
  const visible = filtered.slice((page - 1) * 8, page * 8);

  const startAdd = () => { setForm(blank()); setErrors({}); setModal({ kind: 'form' }); };
  const startEdit = (receipt) => { setForm({ ...receipt }); setErrors({}); setModal({ kind: 'form', id: receipt.id }); };
  const onFile = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setErrors((e) => ({ ...e, image: 'Choose a JPEG, PNG, or WebP image.' }));
    if (file.size > LIMIT) return setErrors((e) => ({ ...e, image: 'Image must be 5 MB or smaller.' }));
    setErrors((e) => ({ ...e, image: '' })); setForm((v) => ({ ...v, image: file }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Enter a merchant or receipt title.';
    if (form.amount === '' || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!form.date || Number.isNaN(Date.parse(`${form.date}T00:00:00`))) next.date = 'Choose a valid purchase date.';
    if (form.date > new Date().toISOString().slice(0, 10)) next.date = 'Purchase date cannot be in the future.';
    if (!CATEGORIES.includes(form.category)) next.category = 'Choose a category.';
    if (!(form.image instanceof Blob)) next.image = 'Upload a receipt image.';
    if (form.image && (!['image/jpeg', 'image/png', 'image/webp'].includes(form.image.type) || form.image.size > LIMIT)) next.image = 'Use a JPEG, PNG, or WebP image up to 5 MB.';
    setErrors(next); if (Object.keys(next).length) return;
    const item = { id: modal.id || `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, userId, title: form.title.trim(), amount: Number(form.amount), date: form.date, category: form.category, notes: form.notes.trim(), image: form.image, updatedAt: new Date().toISOString() };
    try {
      await writeReceipt(item); setReceipts((rows) => [item, ...rows.filter((r) => r.id !== item.id)]);
      setModal(null); notify(modal.id ? 'Receipt updated.' : 'Receipt added.');
      const oldUrl = imageUrls.current.get(item.id); if (oldUrl) URL.revokeObjectURL(oldUrl); imageUrls.current.delete(item.id);
    } catch (e) { notify(`${e.message} Check available browser storage and try again.`, true); }
  };
  const deleteReceipt = async (item) => {
    if (!window.confirm(`Delete the receipt from ${item.title}?`)) return;
    try { await removeReceipt(item.id); setReceipts((rows) => rows.filter((r) => r.id !== item.id)); const url = imageUrls.current.get(item.id); if (url) URL.revokeObjectURL(url); imageUrls.current.delete(item.id); setModal(null); notify('Receipt deleted.'); }
    catch (e) { notify(`${e.message} The receipt is still saved.`, true); }
  };
  const reset = () => { setSearch(''); setCategory(''); setFrom(''); setTo(''); setSort('newest'); setPage(1); };

  return <main className="rv-page"><div className="rv-shell">
    <header className="rv-top"><Link className="rv-brand" to="/dashboard"><span className="rv-mark"/>ApexLedger</Link><nav aria-label="Main navigation"><Link to="/dashboard">Dashboard</Link><span aria-current="page">Receipt Vault</span><Link to="/bills-subscriptions">Bills &amp; Subscriptions</Link><Link to="/financial-news">Financial News</Link><Link to="/reports">Reports</Link></nav><div className="rv-user">{user?.firstName || user?.email || 'Your account'}</div></header>
    <section className="rv-heading"><div><div className="rv-kicker">YOUR DOCUMENTS</div><h1>Receipt Vault</h1><p>Keep every purchase detail and receipt image in one place.</p></div><button className="rv-primary" onClick={startAdd}>＋ Add Receipt</button></section>
    <section className="rv-toolbar" aria-label="Receipt filters">
      <label className="rv-search"><span aria-hidden="true">⌕</span><input aria-label="Search receipts" placeholder="Search merchant or title" value={search} onChange={(e) => setSearch(e.target.value)}/></label>
      <label className="sr-only" htmlFor="rv-category-filter">Filter category</label><select id="rv-category-filter" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <label className="rv-date">From<input aria-label="Start date" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}/></label>
      <label className="rv-date">To<input aria-label="End date" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}/></label>
      <label className="sr-only" htmlFor="rv-sort">Sort receipts</label><select id="rv-sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select>
      <button className="rv-reset" onClick={reset}>Reset</button>
    </section>
    <div className="rv-count" aria-live="polite">{filtered.length} matching {filtered.length === 1 ? 'receipt' : 'receipts'}</div>
    {busy ? <div className="rv-empty" role="status">Loading your receipts…</div> : visible.length ? <div className="rv-grid">{visible.map((item) => <article className="rv-card" key={item.id}>
      <button className="rv-thumb" onClick={() => setModal({ kind: 'view', item })} aria-label={`View receipt image for ${item.title}`}><img src={getImageUrl(item)} alt={`Receipt from ${item.title}`} loading="lazy"/><span>View image</span></button>
      <div className="rv-card-body"><div className="rv-card-title"><h2 title={item.title}>{item.title}</h2><strong>{Number(item.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</strong></div><div className="rv-card-meta"><span>{dateLabel(item.date)}</span><span className="rv-pill">{item.category}</span></div>{item.notes && <p className="rv-note">{item.notes}</p>}<div className="rv-actions"><button onClick={() => setModal({ kind: 'view', item })}>View</button><button onClick={() => startEdit(item)}>Edit</button><button className="rv-delete" onClick={() => deleteReceipt(item)}>Delete</button></div></div>
    </article>)}</div> : <div className="rv-empty"><div className="rv-empty-icon">▧</div><h2>{receipts.length ? 'No receipts match these filters' : 'Your vault is ready'}</h2><p>{receipts.length ? 'Try another search or reset the filters.' : 'Add a receipt to keep its image and purchase details together.'}</p>{receipts.length ? <button className="rv-secondary" onClick={reset}>Reset filters</button> : <button className="rv-primary" onClick={startAdd}>＋ Add your first receipt</button>}</div>}
    {filtered.length > 8 && <div className="rv-pagination"><span>Showing {(page - 1) * 8 + 1}–{Math.min(page * 8, filtered.length)} of {filtered.length}</span><div><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>}
  </div>
  {modal && <div className="rv-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className={`rv-modal ${modal.kind === 'view' ? 'rv-modal-view' : ''}`} role="dialog" aria-modal="true" aria-labelledby="rv-modal-title"><div className="rv-modal-head"><div><div className="rv-kicker">{modal.kind === 'view' ? 'SAVED RECEIPT' : 'RECEIPT DETAILS'}</div><h2 id="rv-modal-title">{modal.kind === 'view' ? modal.item.title : modal.id ? 'Edit receipt' : 'Add receipt'}</h2></div><button className="rv-close" onClick={() => setModal(null)} aria-label="Close dialog">×</button></div>
    {modal.kind === 'view' ? <><img className="rv-large-image" src={getImageUrl(modal.item)} alt={`Full receipt from ${modal.item.title}`}/><div className="rv-view-meta"><span>{dateLabel(modal.item.date)} · {modal.item.category}</span><strong>{Number(modal.item.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</strong></div>{modal.item.notes && <p className="rv-view-notes">{modal.item.notes}</p>}<div className="rv-modal-actions"><button className="rv-secondary" onClick={() => startEdit(modal.item)}>Edit receipt</button><button className="rv-primary" onClick={() => setModal(null)}>Done</button></div></> : <form onSubmit={submit} noValidate>
      <div className="rv-form-grid"><Field id="rv-title" label="Merchant or title" error={errors.title}><input id="rv-title" value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Corner Market" autoFocus/></Field><Field id="rv-amount" label="Amount (USD)" error={errors.amount}><input id="rv-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00"/></Field><Field id="rv-date" label="Purchase date" error={errors.date}><input id="rv-date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></Field><Field id="rv-category" label="Category" error={errors.category}><select id="rv-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Choose a category</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field></div>
      <Field id="rv-notes" label="Notes (optional)"><textarea id="rv-notes" rows="3" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add a note about this purchase"/></Field>
      <Field id="rv-image" label="Receipt image · JPEG, PNG, or WebP · up to 5 MB" error={errors.image}><input ref={fileRef} id="rv-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0])}/>{previewUrl && <div className="rv-upload-preview"><img src={previewUrl} alt="Selected receipt preview"/><button type="button" className="rv-reset" onClick={() => { setForm((v) => ({ ...v, image: null })); if (fileRef.current) fileRef.current.value = ''; }}>Remove image</button></div>}</Field>
      <div className="rv-modal-actions"><button type="button" className="rv-secondary" onClick={() => setModal(null)}>Cancel</button><button className="rv-primary" type="submit">{modal.id ? 'Save changes' : 'Save receipt'}</button></div>
    </form>}</section></div>}
  {toast && <div className={`rv-toast ${toast.error ? 'is-error' : ''}`} role="status"><span/>{toast.message}</div>}
  </main>;
}
