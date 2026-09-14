import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isLoggedIn: boolean;
  userType: 'student' | 'admin';
  userCode: string;
}

const initialState: AuthState = {
  isLoggedIn: false,
  userType: 'student',
  userCode: '',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginAsStudent(state, action: PayloadAction<string>) {
      state.isLoggedIn = true;
      state.userType = 'student';
      state.userCode = action.payload;
    },
    loginAsAdmin(state) {
      state.isLoggedIn = true;
      state.userType = 'admin';
      state.userCode = '';
    },
    logout(state) {
      state.isLoggedIn = false;
      state.userType = 'student';
      state.userCode = '';
    },
  },
});

export const { loginAsStudent, loginAsAdmin, logout } = authSlice.actions;
export default authSlice.reducer;
