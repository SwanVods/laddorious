import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../app/theme.css';
import './cards.css';
import { loadCards, saveCards } from './api';
import { CardsApp } from './CardsApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CardsApp api={{ loadCards, saveCards }} />
  </StrictMode>,
);
