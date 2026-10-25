import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFinancialNews } from './newsSlice.js';
import './financialNews.css';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function FinancialNews({ user }) {
  const dispatch = useDispatch();
  const { articles, status, error } = useSelector((state) => state.news);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (status === 'idle') dispatch(fetchFinancialNews());
  }, [dispatch, status]);

  const visibleArticles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return articles;
    return articles.filter((article) => [article.title, article.description, article.source?.name].some((text) => text?.toLocaleLowerCase().includes(query)));
  }, [articles, search]);

  return <main className="rv-page fn-page"><div className="rv-shell">
    <header className="rv-top"><Link className="rv-brand" to="/dashboard"><span className="rv-mark"/>ApexLedger</Link><nav aria-label="Main navigation"><Link to="/dashboard">Dashboard</Link><Link to="/receipts">Receipt Vault</Link><Link to="/bills-subscriptions">Bills &amp; Subscriptions</Link><span aria-current="page">Financial News</span><Link to="/reports">Reports</Link></nav><div className="rv-user">{user?.firstName || user?.email || 'Your account'}</div></header>
    <section className="rv-heading fn-heading"><div><div className="rv-kicker">MARKET UPDATES</div><h1>Financial News</h1><p>Recent stories about finance, stocks, and the economy.</p></div></section>
    <label className="fn-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search articles by keyword" aria-label="Search news articles"/></label>
    {status === 'loading' && <div className="fn-message" role="status">Loading financial news…</div>}
    {status === 'failed' && <div className="fn-message fn-error" role="alert"><p>{error}</p><button className="rv-primary" onClick={() => dispatch(fetchFinancialNews())}>Retry</button></div>}
    {status === 'succeeded' && visibleArticles.length > 0 && <><div className="rv-count" aria-live="polite">Showing {visibleArticles.length} {visibleArticles.length === 1 ? 'article' : 'articles'}</div><section className="fn-grid" aria-label="Financial news articles">{visibleArticles.map((article, index) => <article className="fn-card" key={`${article.url || article.title}-${index}`}><div className="fn-meta"><span>{article.source?.name || 'Unknown source'}</span><time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time></div><h2>{article.title || 'Untitled article'}</h2><p>{article.description || 'No description was provided for this article.'}</p>{article.url && <a href={article.url} target="_blank" rel="noreferrer">Read original article <span aria-hidden="true">↗</span></a>}</article>)}</section></>}
    {status === 'succeeded' && visibleArticles.length === 0 && <div className="rv-empty"><div className="rv-empty-icon">⌕</div><h2>{articles.length ? 'No matching articles' : 'No news articles available'}</h2><p>{articles.length ? 'Try a different keyword.' : 'GNews returned no recent articles. Try again later.'}</p>{!articles.length && <button className="rv-secondary" onClick={() => dispatch(fetchFinancialNews())}>Retry</button>}</div>}
  </div></main>;
}
