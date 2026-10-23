/**
 * Power and numerical formatting utilities.
 * Default units are MW. Values can also be formatted in GW where appropriate.
 */

/**
 * Format a power value in MW with thousands separators (e.g. 7779 -> "7,779 MW").
 */
export function formatMw(mw: number, decimals = 0): string {
  if (!isFinite(mw)) return "—";
  return `${mw.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} MW`;
}

/**
 * Format a power value in GW (e.g. 7779 MW -> "7.78 GW").
 */
export function formatGw(mw: number, decimals = 2): string {
  if (!isFinite(mw)) return "—";
  const gw = mw / 1000;
  return `${gw.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} GW`;
}

/**
 * Format signed error MW with explicit + or - sign (e.g. -1002 -> "-1,002 MW", 340 -> "+340 MW").
 */
export function formatSignedErrorMw(mw: number, decimals = 0): string {
  if (!isFinite(mw)) return "—";
  const sign = mw > 0 ? "+" : mw < 0 ? "-" : "";
  const absFormatted = Math.abs(mw).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${absFormatted} MW`;
}

/**
 * Format a percentage value (e.g. 8.7 -> "8.7%").
 */
export function formatPercent(val: number, decimals = 1): string {
  if (!isFinite(val)) return "—";
  return `${val.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}
