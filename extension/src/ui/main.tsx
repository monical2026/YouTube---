import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { HistoryPage } from '../history/HistoryPage';
import './style.css';
const history = new URLSearchParams(location.search).has('history');
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{history ? <HistoryPage /> : <App />}</React.StrictMode>,
);
