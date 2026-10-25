import { configureStore } from '@reduxjs/toolkit';
import billsReducer from './store/billsSlice.js';
import newsReducer from './features/news/newsSlice.js';

export const store = configureStore({
  reducer: {
    bills: billsReducer,
    news: newsReducer,
  },
});
