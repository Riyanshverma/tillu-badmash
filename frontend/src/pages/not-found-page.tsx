import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
      <div className="max-w-md p-8 bg-white border border-slate-200 rounded-[12px] shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          404 Error
        </span>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The requested route does not exist in the Wind Decision Console.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-[6px] hover:bg-blue-700 transition-colors"
          >
            Back to Decision Console
          </Link>
        </div>
      </div>
    </div>
  );
}
