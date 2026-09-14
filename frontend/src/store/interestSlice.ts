import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/client";

export interface Interest {
  id: number;
  user_id: number;
  user_name?: string | null;   // student's name, so the admin can tell requests apart
  lot_id: number;
  lot_name?: string;
  space_ids?: number[];        // spots the student picked
  space_labels?: string[];     // their labels, for display
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
}

interface InterestState {
  mine: Interest | null;   // this student's current request (one active at a time)
  all: Interest[];         // the admin's full list
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: InterestState = { mine: null, all: [], status: "idle", error: null };

// GET /api/interest/me -> Interest | null
export const fetchMyInterest = createAsyncThunk(
  "interest/me",
  () => api.get("/api/interest/me") as Promise<Interest | null>,
);

// POST /api/interest { lotId, spaceIds } -> Interest   (student picks specific spots)
export const registerInterest = createAsyncThunk(
  "interest/register",
  (args: { lotId: number; spaceIds: number[] }) =>
    api.post("/api/interest", { lotId: args.lotId, spaceIds: args.spaceIds }) as Promise<Interest>,
);

// DELETE /api/interest/me   (student withdraws their active request)
export const withdrawInterest = createAsyncThunk(
  "interest/withdraw",
  async (_: void, { dispatch }) => {
    await api.del("/api/interest/me");
    await dispatch(fetchMyInterest());
  },
);

// GET /api/interest?status=pending -> Interest[]   (admin)
export const fetchInterest = createAsyncThunk(
  "interest/all",
  (statusFilter: string = "pending") => api.get(`/api/interest?status=${statusFilter}`) as Promise<Interest[]>,
);

// DELETE /api/assignments/:spaceId   (admin — unassign; reverts the student's request to pending)
export const unassignSpace = createAsyncThunk(
  "interest/unassign",
  async (args: { spaceId: number; lotId: number }, { dispatch }) => {
    await api.del(`/api/assignments/${args.spaceId}`);
    await dispatch(fetchInterest("pending"));
    return args;
  },
);

// POST /api/assignments/move { fromSpaceId, toLotId }   (admin — unassign + re-queue the request to another lot)
export const moveAssignment = createAsyncThunk(
  "interest/move",
  async (args: { fromSpaceId: number; toLotId: number }, { dispatch }) => {
    await api.post("/api/assignments/move", { fromSpaceId: args.fromSpaceId, toLotId: args.toLotId });
    await dispatch(fetchInterest("pending"));
    return args;
  },
);

// POST /api/assignments { spaceId, userId, interestId }   (admin)
export const createAssignment = createAsyncThunk(
  "interest/assign",
  async (args: { spaceId: number; userId: number; interestId: number; lotId: number }, { dispatch }) => {
    await api.post("/api/assignments", {
      spaceId: args.spaceId, userId: args.userId, interestId: args.interestId,
    });
    await dispatch(fetchInterest("pending"));
    return args;
  },
);

const interestSlice = createSlice({
  name: "interest",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const pending = (state: InterestState) => { state.status = "loading"; state.error = null; };
    const fail = (state: InterestState, action: { error: { message?: string } }) => {
      state.status = "error";
      state.error = action.error.message ?? "Something went wrong";
    };
    builder
      .addCase(fetchMyInterest.pending, pending)
      .addCase(fetchMyInterest.fulfilled, (state, action) => { state.status = "idle"; state.mine = action.payload; })
      .addCase(fetchMyInterest.rejected, fail)
      .addCase(registerInterest.pending, pending)
      .addCase(registerInterest.fulfilled, (state, action) => { state.status = "idle"; state.mine = action.payload; })
      .addCase(registerInterest.rejected, fail)
      .addCase(fetchInterest.fulfilled, (state, action) => { state.status = "idle"; state.all = action.payload; })
      .addCase(fetchInterest.rejected, fail)
      .addCase(createAssignment.rejected, fail)
      .addCase(unassignSpace.rejected, fail)
      .addCase(moveAssignment.rejected, fail)
      .addCase(withdrawInterest.rejected, fail);
  },
});

export default interestSlice.reducer;
