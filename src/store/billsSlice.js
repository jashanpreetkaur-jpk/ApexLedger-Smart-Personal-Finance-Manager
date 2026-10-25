import { createSlice } from '@reduxjs/toolkit';

const billsSlice = createSlice({
  name: 'bills',
  initialState: { userId: null, bills: [], subscriptions: [] },
  reducers: {
    loadForUser(state, action) {
      state.userId = action.payload.userId;
      state.bills = action.payload.bills;
      state.subscriptions = action.payload.subscriptions;
    },
    replaceBills(state, action) {
      if (state.userId === action.payload.userId) state.bills = action.payload.bills;
    },
    replaceSubscriptions(state, action) {
      if (state.userId === action.payload.userId) state.subscriptions = action.payload.subscriptions;
    },
  },
});

export const { loadForUser, replaceBills, replaceSubscriptions } = billsSlice.actions;
export default billsSlice.reducer;
