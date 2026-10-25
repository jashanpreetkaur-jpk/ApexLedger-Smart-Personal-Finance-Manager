import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ReceiptVault from './ReceiptVault.jsx';
import BillsSubscriptions from './BillsSubscriptions.jsx';
import FinancialNews from './features/news/FinancialNews.jsx';
import Reports from './Reports.jsx';

const UserContext = createContext(null);
const routes = {
  '/': 'index', '/login': 'login', '/signup': 'signup',
  '/dashboard': 'dashboard', '/profile': 'profile',
};

function readUser() {
  try {
    const session = JSON.parse(localStorage.getItem('apexledger_auth') || 'null');
    const users = JSON.parse(localStorage.getItem('apexledger_users') || '[]');
    return session && users.find((user) => user.id === session.userId) || null;
  } catch { return null; }
}

function LegacyPage({ name }) {
  const [markup, setMarkup] = useState('');
  const [loadError, setLoadError] = useState('');
  const location = useLocation();
  const user = useContext(UserContext);

  useEffect(() => {
    let cancelled = false;
    const links = [];
    const scripts = [];
    async function loadPage() {
      setLoadError('');
      setMarkup('<div class="page-loading" role="status">Loading ApexLedger…</div>');
      try {
        const response = await fetch(`/pages/${name}.html`);
        if (!response.ok) throw new Error('Page could not be loaded.');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        document.title = doc.title;
        doc.querySelectorAll('link[rel="stylesheet"]').forEach((item) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = item.getAttribute('href').replace(/^\//, '/');
          document.head.appendChild(link);
          links.push(link);
        });
        const scriptUrls = [...doc.querySelectorAll('script[src]')].map((item) => item.getAttribute('src'));
        doc.querySelectorAll('script, link[rel="stylesheet"]').forEach((item) => item.remove());
        if (!cancelled) setMarkup(doc.body.innerHTML);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        for (const src of scriptUrls) {
          if (cancelled) break;
          await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `/${src.replace(/^\//, '')}`;
            script.onload = resolve;
            script.onerror = resolve;
            document.body.appendChild(script);
            scripts.push(script);
          });
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    }
    loadPage();
    return () => {
      cancelled = true;
      links.forEach((link) => link.remove());
      scripts.forEach((script) => script.remove());
    };
  }, [name, location.key]);

  useEffect(() => {
    const handleNavigation = (event) => {
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.target || event.defaultPrevented || event.button !== 0) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      let path = url.pathname;
      path = path.replace(/\/(index|login|signup|dashboard|profile)\.html$/, (_, page) => ({ index: '/', login: '/login', signup: '/signup', dashboard: '/dashboard', profile: '/profile' })[page]);
      if (path === location.pathname && url.hash) return;
      if (['/', '/login', '/signup', '/dashboard', '/profile', '/receipts', '/bills-subscriptions', '/financial-news', '/reports'].includes(path)) {
        event.preventDefault();
        window.history.pushState({}, '', path + url.hash);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    document.addEventListener('click', handleNavigation);
    return () => document.removeEventListener('click', handleNavigation);
  }, [location.pathname]);

  if (name === 'dashboard' || name === 'profile') {
    if (!user) return <Navigate to="/login" replace />;
  }
  if ((name === 'login' || name === 'signup') && user) return <Navigate to="/dashboard" replace />;
  if (loadError) return <main className="page-error"><h1>ApexLedger could not load this page</h1><p>{loadError}</p><Link to="/">Return home</Link></main>;
  return <div className={`legacy-page page-${name}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function NotFound() {
  return <main className="page-error"><h1>Page not found</h1><p>That ApexLedger page does not exist.</p><Link to="/">Return to ApexLedger</Link></main>;
}

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState(readUser);
  useEffect(() => setUser(readUser()), [location.pathname, location.key]);
  return <UserContext.Provider value={user}>
    <Routes>
      {Object.entries(routes).map(([path, name]) => <Route key={path} path={path} element={<LegacyPage name={name} />} />)}
      <Route path="/receipts" element={user ? <ReceiptVault user={user} /> : <Navigate to="/login" replace />} />
      <Route path="/bills-subscriptions" element={user ? <BillsSubscriptions user={user} /> : <Navigate to="/login" replace />} />
      <Route path="/financial-news" element={user ? <FinancialNews user={user} /> : <Navigate to="/login" replace />} />
      <Route path="/reports" element={user ? <Reports user={user} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </UserContext.Provider>;
}
