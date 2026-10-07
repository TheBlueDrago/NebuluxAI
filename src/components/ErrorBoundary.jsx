import { reportError } from "@/lib/errorReport";
import React from "react";
import { isUpdateError, mayAutoReload, freshReload } from "@/lib/updateReload";

// Catches a crash anywhere below it so the app shows a way out instead of going blank.
// A crash caused by an update going live (the page asks for code files of the version before)
// isn't really an error: it says so and reloads by itself a few seconds later.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.timer = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info?.componentStack);
    if (!isUpdateError(error)) reportError(error, String(info?.componentStack || "").slice(0, 600));
    if (isUpdateError(error) && mayAutoReload()) {
      this.timer = setTimeout(freshReload, 2500);
      this.setState({ auto: true });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const updating = isUpdateError(this.state.error);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-200 p-6 text-center">
        {updating && this.state.auto && <span className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" aria-hidden="true" />}
        <p className="text-lg font-semibold">{updating ? "Nebulux AI was just updated" : "Something went wrong."}</p>
        <p className="text-sm text-slate-400 max-w-sm">
          {updating ? (this.state.auto ? "Loading the new version… This takes a few seconds." : "Press Reload to get the new version.") : "Reloading usually fixes it — especially right after Nebulux AI was updated."}
        </p>
        <button
          onClick={() => (isUpdateError(this.state.error) ? freshReload() : window.location.reload())}
          className="mt-2 px-5 py-2 rounded-xl bg-indigo-600 text-[#fff] text-sm font-medium hover:bg-indigo-700"
        >
          Reload
        </button>
        {/* A plain link: this screen can show when the page's own navigation is what broke. */}
        <a href="/contact?topic=bug" className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200">
          Keeps happening? Tell us
        </a>
      </div>
    );
  }
}
