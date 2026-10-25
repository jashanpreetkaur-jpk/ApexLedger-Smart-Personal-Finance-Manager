import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import App from './router.jsx';
import './app.css';
import { store } from './store.js';

createRoot(document.getElementById('root')).render(
  <Provider store={store}><BrowserRouter><App /></BrowserRouter></Provider>,
);
