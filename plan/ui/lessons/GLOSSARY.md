# Glossary — the words these lessons use

New words show up fast when you build a website. This page explains each one in **one or two plain sentences**, the way you'd explain it to a friend. Every lesson links the *first* time it uses a word here, so you can click, read, and jump back.

> **How to read this:** you do **not** need to memorize any of this before you start. Skim it once, then come back whenever a lesson uses a word you don't recognize. The official docs are linked at the end of each entry if you want the full story.

---

## The tools that run your project

### Vite
The program that runs your project while you build it (`npm run dev`) and packages it up for the real internet (`npm run build`). Think of it as the workshop your app is built in. → [Vite docs](https://vite.dev/guide/).

### TypeScript
JavaScript (the language browsers speak) with **labels on your data** added. The labels let the computer catch mistakes — like putting a word where a number belongs — *before* you ever run the app. → [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).

### ESLint
A "linter": a tool that *reads* your code without running it and points out likely mistakes and messy spots, the way a spell-checker underlines typos. → [ESLint docs](https://eslint.org/docs/latest/use/getting-started).

### npm
The tool that downloads code other people wrote (called **packages**) into your project so you don't have to write everything yourself. `npm install react-router-dom` fetches one. → [npm docs](https://docs.npmjs.com/cli/v10/commands/npm-install).

---

## Building blocks of the app (React)

### React
The library this whole website is built with. You describe what each screen should look like, and React puts it on the page and keeps it up to date when things change. → [React docs](https://react.dev/learn).

### Component
One reusable piece of a screen — a button, a form, a whole dashboard. In this project a component is a function that returns the HTML-looking markup (JSX) for that piece. → [React: Your First Component](https://react.dev/learn/your-first-component).

### Props
The values you hand *into* a component to customize it, like handing arguments to a function: `<ProtectedRoute role="admin">` passes the prop `role`. → [React: Passing Props](https://react.dev/learn/passing-props-to-a-component).

### State
The data a component *remembers* while it's on screen — what you typed, whether a menu is open. When state changes, React re-draws that part of the screen. → [React: State](https://react.dev/learn/state-a-components-memory).

### Hook
A special React function whose name starts with `use…`. Hooks let a component remember state (`useState`), run code at the right moment (`useEffect`), or keep a value across re-draws (`useRef`). → [React: Hooks](https://react.dev/reference/react/hooks).

### useState
The hook that gives a component a piece of memory plus a function to change it: `const [open, setOpen] = useState(false)`. Calling `setOpen(true)` re-draws the screen with the new value. → [React: useState](https://react.dev/reference/react/useState).

### useEffect
The hook that runs some code *after* the screen draws — for example, "when the page first loads, ask the server who I am." → [React: useEffect](https://react.dev/reference/react/useEffect).

### useRef
The hook that keeps a value between re-draws **without** re-drawing when it changes — handy for remembering a DOM element or a scratch value during a drag. → [React: useRef](https://react.dev/reference/react/useRef).

### Fragment
Written `<>…</>`. An empty wrapper that lets a component return several elements without adding an extra box around them on the page. → [React: Fragment](https://react.dev/reference/react/Fragment).

### Error boundary
A safety-net component that catches a crash in the screen and shows an error message instead of leaving the page blank. → [React: Error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).

### Interface
Also called a **type**. A TypeScript label that describes the **shape** of an object — which fields it has and what kind each one is. `interface User { id: number; name: string }` says "a User always has a number id and a text name." → [TS: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types).

---

## Remembering data across the whole app (Redux Toolkit)

### Redux
The app's **shared memory**: one central place every screen can read from and write to, so the login screen and the dashboard always agree on who's logged in. → [Redux: Motivation](https://redux.js.org/understanding/thinking-in-redux/motivation).

### Redux Toolkit
Often shortened to **RTK**. The modern, batteries-included way to use Redux — it writes most of the boilerplate for you. Everything below (slice, thunk, selector) is part of it. → [Redux Toolkit docs](https://redux-toolkit.js.org/).

### Store
The single object that holds all of Redux's shared memory. The app has exactly one. → [RTK: configureStore](https://redux-toolkit.js.org/api/configureStore).

### Slice
One labeled section of the store — e.g. the `auth` slice holds login info, the `parking` slice holds lots and spaces. Each slice lives in its own file. → [RTK: createSlice](https://redux-toolkit.js.org/api/createSlice).

### Reducer
The function that actually changes a slice's data in response to something happening. You rarely call it directly — you dispatch an action and Redux runs the matching reducer. → [Redux: Reducers](https://redux.js.org/tutorials/fundamentals/part-3-state-actions-reducers).

### Action
A little message that says "something happened" (e.g. "login succeeded"). Dispatching an action is how you ask the store to change. → [Redux: Actions](https://redux.js.org/tutorials/fundamentals/part-3-state-actions-reducers#actions).

### Dispatch
The verb for "send an action to the store," which triggers the matching reducer: `dispatch(logout())`. → [Redux: Dispatching](https://redux.js.org/tutorials/fundamentals/part-4-store#dispatching-actions).

### Thunk
A thunk is an action that has to wait for something slow, like a network call. `createAsyncThunk` wraps that slow call and automatically reports three stages — *pending* (still going), *fulfilled* (worked), *rejected* (failed) — so your slice can react to each. → [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk).

### Selector
A function that *reads* one value out of the store inside a component: `useAppSelector(s => s.auth.isLoggedIn)`. When that value changes, the component re-draws. → [React-Redux: useSelector](https://react-redux.js.org/api/hooks#useselector).

### extraReducers
The part of a slice that reacts to thunks defined elsewhere — one case each for a thunk's pending / fulfilled / rejected stages. → [RTK: createSlice](https://redux-toolkit.js.org/api/createSlice#extrareducers).

---

## Talking to the server (networking)

### API
The set of web addresses the server offers for your app to call — like `POST /api/auth/student` to log in. Short for *Application Programming Interface*. → [MDN: Web APIs](https://developer.mozilla.org/en-US/docs/Web/API).

### Endpoint
One specific address in the API, e.g. `/api/auth/me`. Each endpoint does one job. → [MDN: Web APIs](https://developer.mozilla.org/en-US/docs/Web/API).

### Fetch
The browser's built-in way (`fetch`) to send a request to a server and get an answer back. Our `client.ts` wraps it so every screen calls it the same way. → [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

### HTTP methods
The five "verbs" a request can use: **GET** reads data, **POST** creates something, **PATCH** changes part of something, **PUT** replaces it whole, **DELETE** removes it. → [MDN: HTTP methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods).

### Envelope
The server wraps every good answer as `{ data: … }` and every error as `{ error: { message } }`. Our client "unwraps" it so screens just get the useful part. → [MDN: JSON](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON).

### JWT
Also just called a **token**. A signed slip of text the server hands you at login that proves "yes, this is user #12, a student." The browser stores it and re-sends it on every later request so you don't retype your password. → [jwt.io: Introduction](https://jwt.io/introduction).

### localStorage
A tiny storage box in the browser that survives a page refresh — where we keep the login token so refreshing doesn't log you out. → [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

### CORS
A browser safety rule that blocks a page from calling a server on a different address unless that server says "this address is allowed." When it blocks you, you see a "CORS policy" error. → [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

### Environment variable
A setting read from *outside* the code (from a `.env` file) so it can differ per computer — like the backend's address being `localhost` on your laptop but something else once deployed. → [Vite: Env Variables](https://vite.dev/guide/env-and-mode).

### Mock backend
A pretend server built into the frontend that answers requests from data kept in the browser, so you can run the whole app on your laptop without starting the real server. It's **on by default** in this project. → [Lesson U0](U0-project-hygiene.md).

---

## Pages and addresses (React Router)

### React Router
The library that connects a browser address (like `/admin`) to the screen that should show there, and makes the Back/Forward buttons work. → [React Router docs](https://reactrouter.com/en/main).

### Routing
A rule that says "when the address is `/student`, show the student dashboard." Routing is the whole system of those rules. → [React Router: Route](https://reactrouter.com/en/main/route/route).

### SPA
Short for **single-page app**: a site that swaps *pieces* of the page as you navigate instead of reloading the whole page from scratch — so it feels instant and doesn't lose your place. → [MDN: SPA](https://developer.mozilla.org/en-US/docs/Glossary/SPA).

### Protected route
A wrapper that checks "are you allowed on this page?" and bounces you to the login screen if not, before the real page ever shows. → [React Router: Navigate](https://reactrouter.com/en/main/components/navigate).

---

## A few more you'll meet

### FormData
A helper that reads everything typed into a `<form>` at once, by each field's `name`, instead of tracking every keystroke. → [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).

### Normalized coordinates
Instead of storing a parking spot's position in pixels (which change with screen size), we store it as a **fraction** from 0 to 1 — "40% across, 60% down." That way it lands in the right place on any screen. → [Lesson U3](U3-show-real-lots-and-spaces.md).

### getBoundingClientRect
A browser function that tells you exactly where an element sits on screen and how big it is — used to turn a mouse position into one of those 0-to-1 fractions. → [MDN: getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).

### CSV
A plain-text spreadsheet format — one row per line, columns separated by commas. Used to import/export the student roster in U10. → [MDN: CSV](https://developer.mozilla.org/en-US/docs/Glossary/CSV).

---

*Missing a word? It probably means it hasn't come up in a lesson yet. Add it here the first time a lesson uses it, keeping the one-or-two-sentence, plain-language style above.*
