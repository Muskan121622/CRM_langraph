import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const fetchDashboardStats = createAsyncThunk('interaction/fetchStats', async () => {
  const response = await axios.get(`${API_URL}/dashboard-stats/`);
  return response.data;
});

export const fetchHistory = createAsyncThunk('interaction/fetchHistory', async () => {
  const response = await axios.get(`${API_URL}/interactions/`);
  return response.data;
});

export const logInteractionAgent = createAsyncThunk('interaction/logAgent', async (message) => {
  const response = await axios.post(`${API_URL}/agent/chat`, { message });
  return response.data;
});

export const fetchFollowUps = createAsyncThunk('interaction/fetchFollowUps', async () => {
  const response = await axios.get(`${API_URL}/followups/`);
  return response.data;
});

const interactionSlice = createSlice({
  name: 'interaction',
  initialState: {
    stats: null,
    history: [],
    followups: [],
    chatThread: [], // [{sender: 'user'|'agent', text: ''}]
    status: 'idle',
    chatStatus: 'idle',
    extractedData: {}, // Store extracted fields from AI
  },
  reducers: {
    addChatMessage(state, action) {
      state.chatThread.push(action.payload);
    },
    clearExtractedData(state) {
      state.extractedData = {};
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      })
      .addCase(fetchFollowUps.fulfilled, (state, action) => {
        state.followups = action.payload;
      })
      .addCase(logInteractionAgent.pending, (state) => {
        state.chatStatus = 'loading';
      })
      .addCase(logInteractionAgent.fulfilled, (state, action) => {
        state.chatStatus = 'succeeded';
        state.chatThread.push({ sender: 'agent', text: action.payload.response });
        if (action.payload.entities) {
          state.extractedData = action.payload.entities;
        }
      })
      .addCase(logInteractionAgent.rejected, (state) => {
        state.chatStatus = 'failed';
        state.chatThread.push({ sender: 'agent', text: 'Sorry, I encountered an error. Please try again.' });
      });
  },
});

export const { addChatMessage } = interactionSlice.actions;
export default interactionSlice.reducer;
