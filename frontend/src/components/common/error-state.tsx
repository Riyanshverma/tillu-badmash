import { AlertCircle, Database, RefreshCw } from "lucide-react";
import { ApiError, ContractValidationError } from "../../lib/api-client";

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  entityName?: string;
}

export function ErrorState({
  title,
  error,
  onRetry,
  entityName = "data",
}: ErrorStateProps) {
  let isMissingData = false;
  let isContractError = false;
  let errorMessage = "Unable to load data.";
  let detailMessage: string | null = null;

  if (error instanceof ApiError) {
    if (error.status === 404) {
      isMissingData = true;
      errorMessage = "No January wind data is available yet.";
      if (
        error.body &&
        typeof error.body === "object" &&
        "detail" in error.body &&
        typeof error.body.detail === "string"
      ) {
        detailMessage = error.body.detail;
      } else {
        detailMessage =
          "The database has not been populated for this date or period. Please run the backend sync command to ingest Elexon records.";
      }
    } else {
      errorMessage = `Unable to load ${entityName} (HTTP ${error.status}).`;
      detailMessage = error.statusText || null;
    }
  } else if (error instanceof ContractValidationError) {
    isContractError = true;
    errorMessage = "The API returned data in an unexpected format.";
    detailMessage =
      "The response did not pass public contract validation. Please inspect console logs for schema mismatch details.";
  } else if (error instanceof Error) {
    errorMessage = error.message || `Unable to load ${entityName}.`;
    if (error.message.includes("Failed to fetch")) {
      detailMessage =
        "Could not connect to the backend API. Please ensure the server is running.";
    }
  }

  return (
    <div
      role="alert"
      className="bg-white border border-slate-200 rounded-[12px] p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-center max-w-lg mx-auto my-8 space-y-4"
    >
      <div className="flex justify-center">
        {isMissingData ? (
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Database className="w-6 h-6" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-slate-900 tracking-[-0.01em]">
          {title || errorMessage}
        </h3>
        {detailMessage && (
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            {detailMessage}
          </p>
        )}
      </div>

      {isContractError && (
        <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-2.5 text-[11px] text-slate-600 font-mono text-left">
          Zod schema validation failed for runtime API response.
        </div>
      )}

      {onRetry && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
}
