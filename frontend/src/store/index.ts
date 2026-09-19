import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import authReducer from './authSlice';
import parkingReducer from './parkingSlice';
import interestReducer from './interestSlice';
import studentsReducer from './studentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    parking: parkingReducer,
    interest: interestReducer,
    students: studentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks — use these instead of plain useDispatch/useSelector throughout the app
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
