import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export const fetchFinancialNews = createAsyncThunk(
  'news/fetchFinancialNews',
  async (_, { rejectWithValue }) => {
    const apiKey = import.meta.env.VITE_GNEWS_API_KEY;
    if (!apiKey) return rejectWithValue('GNews API key is missing. Add VITE_GNEWS_API_KEY to your .env file and restart Vite.');

    const params = new URLSearchParams({
      q: 'finance OR stocks OR economy',
      lang: 'en',
      max: '10',
      apikey: apiKey,
    });

    try {
      const response = await fetch(`https://gnews.io/api/v4/search?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return rejectWithValue(data.errors?.[0] || data.message || `GNews request failed (${response.status}).`);
      }
      if (!Array.isArray(data.articles)) return rejectWithValue('The news service returned an unexpected response. Please retry.');
      return data.articles.slice(0, 10);
    } catch (error) {
      return rejectWithValue(error.message || 'Could not connect to GNews. Check your internet connection and retry.');
    }
  },
);

const newsSlice = createSlice({
  name: 'news',
  initialState: { articles: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFinancialNews.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchFinancialNews.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.articles = action.payload;
        state.error = null;
      })
      .addCase(fetchFinancialNews.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Could not load financial news.';
      });
  },
});

export default newsSlice.reducer;
