// src/App.tsx
import { useEffect } from "react";
import "./App.css";
import Login from "./Login";
import { useAppDispatch } from "./store";
import { fetchMe } from "./store/authSlice";

function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Runs once, right after the page loads. If a token was saved last time,
    // confirm it with the server and reload the user, so a refresh keeps you logged in.
    if (localStorage.getItem("token")) {
      dispatch(fetchMe());
    }
  }, [dispatch]);   // the [dispatch] list means "run this effect once"; dispatch never changes

  return (
    <div className="App">
      <Login />
    </div>
  );
}

export default App;