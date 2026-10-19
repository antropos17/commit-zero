import React from "react";
import { PageHeading } from "./ui.jsx";

// Keep a failed page inside the workspace shell. Healthy route changes retain
// the existing subtree; only a failed page is remounted on an explicit retry.
export class PageBoundary extends React.Component {
  state = { failed: false, routeKey: this.props.routeKey };
  fallback = React.createRef();

  static getDerivedStateFromProps(props, state) {
    return props.routeKey !== state.routeKey
      ? { failed: false, routeKey: props.routeKey }
      : null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    const fallback = this.fallback.current;
    const main = fallback?.closest("main");
    if (
      document.activeElement === document.body ||
      main?.contains(document.activeElement)
    )
      fallback?.focus({ preventScroll: true });
  }

  componentDidUpdate(previousProps, previousState) {
    if (
      previousState.failed &&
      !this.state.failed &&
      previousProps.routeKey === this.props.routeKey &&
      document.activeElement === document.body
    )
      this.props.onRecovered();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section
        className="page-failure"
        role="alert"
        tabIndex="-1"
        ref={this.fallback}
      >
        <PageHeading title="This page could not be displayed">
          Try this page again, or use the navigation to open another section.
        </PageHeading>
        <button
          className="btn"
          onClick={() => this.setState({ failed: false })}
        >
          Try this page again
        </button>
      </section>
    );
  }
}
