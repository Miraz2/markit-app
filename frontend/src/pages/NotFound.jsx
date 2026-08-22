import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-parchment-100 bg-grain bg-repeat px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-brass-600">Error 404</p>
      <h1 className="mt-3 font-display text-5xl font-semibold text-forest-900">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm text-forest-700/70">
        This page isn't in the register. Let's get you back to somewhere familiar.
      </p>
      <Link to="/dashboard" className="btn-primary mt-6">
        Back to Dashboard
      </Link>
    </div>
  );
}
