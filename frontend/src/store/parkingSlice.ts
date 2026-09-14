import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api, uploadFile } from "../api/client";

type EditAction = "single" | "group" | "disable" | "enable" | "manual" | "update" | "arrange" | null;

export interface Lot {
  id: number;
  name: string;
  number: number;          // admin-assigned lot number; prefixes this lot's spot labels
  display_order: number;
  map_image_url: string | null;
  capacity: number;
  available_count: number;
}
export interface Space {
  id: number;
  lot_id: number;
  label: string;
  status: "available" | "disabled" | "assigned";
  x?: number | null;
  y?: number | null;
  w?: number | null;   // slot size as a fraction of the map (keeps ratio at any display size)
  h?: number | null;
  rotation?: number | null;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
}

interface ParkingState {
  lots: Lot[];
  selectedLotId: number | null;          // null = the "Home" campus-map view
  spacesByLot: Record<number, Space[]>;  // cache of spaces per lot id
  isEditMode: boolean;
  editAction: EditAction;
  selectedSpaces: number[];              // numeric server ids
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: ParkingState = {
  lots: [],
  selectedLotId: null,
  spacesByLot: {},
  isEditMode: false,
  editAction: null,
  selectedSpaces: [],
  status: "idle",
  error: null,
};

// GET /api/lots -> Lot[]
export const fetchLots = createAsyncThunk("parking/fetchLots", () => api.get("/api/lots") as Promise<Lot[]>);

// GET /api/lots/:id/spaces -> Space[]
export const fetchSpaces = createAsyncThunk("parking/fetchSpaces", async (lotId: number) => {
  const spaces = (await api.get(`/api/lots/${lotId}/spaces`)) as Space[];
  return { lotId, spaces };
});

// PATCH /api/spaces  { ids, status } — persist enable/disable, then reload the truth.
export const updateSpaces = createAsyncThunk(
  "parking/updateSpaces",
  async (args: { lotId: number; ids: number[]; status: "available" | "disabled" }, { dispatch }) => {
    await api.patch("/api/spaces", { ids: args.ids, status: args.status });
    await dispatch(fetchSpaces(args.lotId));
    return args;
  },
);

// PUT /api/lots/:id/layout  { spaces } — full-replace of a lot's spot layout.
export const saveLayout = createAsyncThunk(
  "parking/saveLayout",
  async (
    args: { lotId: number; spaces: Array<Pick<Space, "id" | "label" | "x" | "y" | "w" | "h" | "rotation">> },
    { dispatch },
  ) => {
    await api.put(`/api/lots/${args.lotId}/layout`, { spaces: args.spaces });
    await dispatch(fetchSpaces(args.lotId));
    return args.lotId;
  },
);

// POST /api/lots  { name, number?, capacity? } -> Lot
export const createLot = createAsyncThunk(
  "parking/createLot",
  async (args: { name: string; number?: number; capacity?: number }, { dispatch }) => {
    const lot = (await api.post("/api/lots", args)) as Lot;
    await dispatch(fetchLots());
    return lot;
  },
);

// DELETE /api/lots/:id — remove a lot (server refuses if any of its spaces are assigned)
export const deleteLot = createAsyncThunk(
  "parking/deleteLot",
  async (lotId: number, { dispatch }) => {
    await api.del(`/api/lots/${lotId}`);
    await dispatch(fetchLots());
    return lotId;
  },
);

// POST /api/lots/:id/map  (multipart) — upload a new map image, then refresh.
export const uploadLotMap = createAsyncThunk(
  "parking/uploadMap",
  async (args: { lotId: number; file: File }, { dispatch }) => {
    await uploadFile(`/api/lots/${args.lotId}/map`, args.file);
    await dispatch(fetchLots());
    return args.lotId;
  },
);

const parkingSlice = createSlice({
  name: "parking",
  initialState,
  reducers: {
    setSelectedLot(state, action: PayloadAction<number | null>) {
      state.selectedLotId = action.payload;
      state.selectedSpaces = [];
      state.editAction = null;
    },
    toggleEditMode(state) {
      state.isEditMode = !state.isEditMode;
      if (!state.isEditMode) { state.editAction = null; state.selectedSpaces = []; }
    },
    setIsEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
      if (!action.payload) { state.editAction = null; state.selectedSpaces = []; }
    },
    setEditAction(state, action: PayloadAction<EditAction>) {
      state.editAction = action.payload;
      state.selectedSpaces = [];
    },
    toggleSpaceSelection(state, action: PayloadAction<number>) {
      const id = action.payload;
      const index = state.selectedSpaces.indexOf(id);
      if (index === -1) state.selectedSpaces.push(id);
      else state.selectedSpaces.splice(index, 1);
    },
    clearSelectedSpaces(state) {
      state.selectedSpaces = [];
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLots.fulfilled, (state, action) => { state.lots = action.payload; })
      .addCase(fetchSpaces.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(fetchSpaces.fulfilled, (state, action) => {
        state.status = "idle";
        state.spacesByLot[action.payload.lotId] = action.payload.spaces;
      })
      .addCase(fetchSpaces.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load spaces";
      })
      // enable/disable: optimistic recolour, real reload happens inside the thunk
      .addCase(updateSpaces.pending, (state, action) => {
        const { lotId, ids, status } = action.meta.arg;
        const spaces = state.spacesByLot[lotId];
        if (spaces) for (const space of spaces) if (ids.includes(space.id)) space.status = status;
      })
      .addCase(updateSpaces.fulfilled, (state) => {
        state.selectedSpaces = [];
        state.isEditMode = false;
        state.editAction = null;
      })
      .addCase(updateSpaces.rejected, (state, action) => {
        state.error = action.error.message ?? "Could not save changes";
      })
      .addCase(saveLayout.fulfilled, (state) => { state.editAction = null; state.error = null; })
      .addCase(saveLayout.rejected, (state, action) => {
        state.error = action.error.message ?? "Could not save layout";
      })
      .addCase(createLot.fulfilled, (state, action) => { state.selectedLotId = action.payload.id; })
      .addCase(createLot.rejected, (state, action) => {
        state.error = action.error.message ?? "Could not create lot";
      })
      .addCase(deleteLot.fulfilled, (state, action) => {
        if (state.selectedLotId === action.payload) { state.selectedLotId = null; state.editAction = null; state.selectedSpaces = []; }
        state.error = null;
      })
      .addCase(deleteLot.rejected, (state, action) => {
        state.error = action.error.message ?? "Could not remove lot";
      })
      .addCase(uploadLotMap.rejected, (state, action) => {
        state.error = action.error.message ?? "Map upload failed";
      });
  },
});

export const {
  setSelectedLot, toggleEditMode, setIsEditMode, setEditAction,
  toggleSpaceSelection, clearSelectedSpaces, clearError,
} = parkingSlice.actions;
export default parkingSlice.reducer;
