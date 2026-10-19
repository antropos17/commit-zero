import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AccountProvider, WorkspaceProvider } from "./state.jsx";
import "./app.css";
class ApplicationBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="app-failure">
        <h1>Something went wrong</h1>
        <p>Reload to reconnect to the workspace.</p>
        <button className="btn" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const root =
  import.meta.hot?.data.root || createRoot(document.getElementById("root"));
if (import.meta.hot)
  import.meta.hot.dispose((data) => {
    data.root = root;
  });
root.render(
  <ApplicationBoundary>
    <WorkspaceProvider>
      <AccountProvider>
        <App />
      </AccountProvider>
    </WorkspaceProvider>
  </ApplicationBoundary>,
);
