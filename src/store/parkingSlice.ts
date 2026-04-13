import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type EditAction = 'single' | 'group' | 'disable' | 'enable' | 'manual' | 'update' | null;

interface ParkingState {
  selectedLot: string;
  isEditMode: boolean;
  editAction: EditAction;
}

const initialState: ParkingState = {
  selectedLot: 'Home',
  isEditMode: false,
  editAction: null,
};

const parkingSlice = createSlice({
  name: 'parking',
  initialState,
  reducers: {
    setSelectedLot(state, action: PayloadAction<string>) {
      state.selectedLot = action.payload;
    },
    toggleEditMode(state) {
      state.isEditMode = !state.isEditMode;
      if (!state.isEditMode) {
        state.editAction = null;
      }
    },
    setIsEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
      if (!action.payload) {
        state.editAction = null;
      }
    },
    setEditAction(state, action: PayloadAction<EditAction>) {
      state.editAction = action.payload;
    },
  },
});

export const { setSelectedLot, toggleEditMode, setIsEditMode, setEditAction } = parkingSlice.actions;
export default parkingSlice.reducer;
