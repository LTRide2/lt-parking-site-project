import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type EditAction = 'single' | 'group' | 'disable' | 'enable' | 'manual' | 'update' | null;

interface ParkingState {
  selectedLot: string;
  isEditMode: boolean;
  editAction: EditAction;
  selectedSpaces: string[];
  disabledSpaces: string[];
}

const initialState: ParkingState = {
  selectedLot: 'Home',
  isEditMode: false,
  editAction: null,
  selectedSpaces: [],
  disabledSpaces: [],
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
        state.selectedSpaces = [];
      }
    },
    setIsEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
      if (!action.payload) {
        state.editAction = null;
        state.selectedSpaces = [];
      }
    },
    setEditAction(state, action: PayloadAction<EditAction>) {
      state.editAction = action.payload;
    },
    toggleSpaceSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedSpaces.indexOf(id);
      if (idx === -1) {
        state.selectedSpaces.push(id);
      } else {
        state.selectedSpaces.splice(idx, 1);
      }
    },
    enableSelectedSpaces(state) {
      state.disabledSpaces = state.disabledSpaces.filter(
        id => !state.selectedSpaces.includes(id)
      );
      state.selectedSpaces = [];
    },
    disableSelectedSpaces(state) {
      for (const id of state.selectedSpaces) {
        if (!state.disabledSpaces.includes(id)) {
          state.disabledSpaces.push(id);
        }
      }
      state.selectedSpaces = [];
      state.editAction = null;
      state.isEditMode = false;
    },
    clearSelectedSpaces(state) {
      state.selectedSpaces = [];
    },
  },
});

export const {
  setSelectedLot,
  toggleEditMode,
  setIsEditMode,
  setEditAction,
  toggleSpaceSelection,
  enableSelectedSpaces,
  disableSelectedSpaces,
  clearSelectedSpaces,
} = parkingSlice.actions;
export default parkingSlice.reducer;
