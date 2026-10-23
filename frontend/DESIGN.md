---
version: 2
name: wind-decision-console
description: A precise operational analytics interface for UK day-ahead wind decisions. Dense enough for professional use, visually quiet enough that forecast shape, uncertainty, and error remain the focus.
colors:
  canvas: "#F8FAFC"
  surface: "#FFFFFF"
  surface-subtle: "#F1F5F9"
  ink: "#0F172A"
  ink-muted: "#64748B"
  ink-faint: "#94A3B8"
  border: "#E2E8F0"
  border-strong: "#CBD5E1"
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-soft: "#DBEAFE"
  actual: "#0F172A"
  forecast: "#2563EB"
  uncertainty: "#93C5FD"
  positive-risk: "#DC2626"
  positive-risk-soft: "#FEE2E2"
  negative-error: "#0F766E"
  negative-error-soft: "#CCFBF1"
  warning: "#D97706"
  success: "#15803D"
  focus: "#3B82F6"
typography:
  family: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  display:
    size: "28px"
    weight: 650
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading:
    size: "18px"
    weight: 600
    lineHeight: 1.35
  body:
    size: "14px"
    weight: 400
    lineHeight: 1.5
  bodyStrong:
    size: "14px"
    weight: 600
    lineHeight: 1.4
  metric:
    size: "26px"
    weight: 650
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  caption:
    size: "12px"
    weight: 450
    lineHeight: 1.4
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "12px"
  pill: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "40px"
layout:
  maxWidth: "1440px"
  desktopPadding: "32px"
  tabletPadding: "24px"
  mobilePadding: "16px"
components:
  card:
    background: "{colors.surface}"
    border: "1px solid {colors.border}"
    radius: "{rounded.lg}"
    shadow: "0 1px 2px rgba(15, 23, 42, 0.04)"
    padding: "20px"
  metricCard:
    background: "{colors.surface}"
    border: "1px solid {colors.border}"
    radius: "{rounded.md}"
    shadow: "none"
    padding: "16px"
charts:
  grid: "#E2E8F0"
  axis: "#64748B"
  forecast: "{colors.forecast}"
  actual: "{colors.actual}"
  uncertainty: "{colors.uncertainty}"
  overForecast: "{colors.positive-risk}"
  underForecast: "{colors.negative-error}"
  lineWidth: 2
  activeLineWidth: 2.5
---

# Overview

The interface should feel like a compact operational console built for a power-market professional, not a generic SaaS analytics template.

The product is data-first.

The hierarchy must make three questions immediately answerable:

1. Which forecast vintage was available at the 09:20 decision cutoff?
2. What hourly wind profile was expected for the delivery day?
3. How large and directional have historical hourly forecast errors been?

The visual language is neutral and quiet:

- cool slate canvas
- white surfaces
- one dominant forecast blue
- charcoal actuals
- red for over-forecast
- teal for under-forecast
- minimal elevation
- explicit units and timestamps

Avoid decorative gradients, glassmorphism, large hero areas, oversized cards, or colorful icon grids.

---

# Data-density rules

The application works on an **hourly analytical resolution**.

Per delivery day:

```text
24 forecast points
24 derived hourly actual points
24 comparison/error points
```

The January heatmap is:

```text
31 rows × 24 hourly columns
```

Do not design product charts around 48 half-hour forecast points.

FUELHH's half-hour resolution is an upstream/backend concern.

---

# Layout

## App shell

Use a top navigation bar.

There are only two primary views:

```text
Decision
Accuracy
```

Recommended shell:

```text
[Wind Decision Console]     Decision     Accuracy        Elexon data
```

No persistent sidebar.

Maximum content width:

```text
1440px
```

Desktop padding:

```text
32px
```

Section gap:

```text
40px
```

Card gap:

```text
16px
```

---

# Typography

Use Inter if already present; otherwise use the system fallback stack.

Do not spend assessment time on decorative fonts.

Page title:

```text
28px / 650
```

Section title:

```text
18px / 600
```

Body:

```text
14px / 400
```

Metric value:

```text
26px / 650
```

Metadata:

```text
12px
```

Use tabular numerals where supported.

---

# Color semantics

## Forecast

```text
#2563EB
```

## Actual

```text
#0F172A
```

## Historical P90 error band

Use the forecast blue at low opacity.

## Positive error

Definition:

```text
forecast - actual > 0
```

Meaning:

```text
wind was over-forecast
```

Color:

```text
#DC2626
```

## Negative error

Definition:

```text
forecast - actual < 0
```

Meaning:

```text
wind was under-forecast
```

Color:

```text
#0F766E
```

Never use color as the only explanation of direction.

---

# Cards

Cards:

- white background
- thin slate border
- 10–12px radius
- little or no shadow

Metric card pattern:

```text
Label
Value + unit
Short interpretation
```

Example:

```text
Historical MAE
742 MW
Typical absolute hourly miss
```

---

# Controls

Use shadcn components where useful:

- Select
- Popover
- Calendar/date picker
- Tooltip
- Badge
- Skeleton
- Alert
- Separator

Decision date selection is limited to:

```text
2026-01-01 through 2026-01-31
```

The decision cutoff is fixed in v1.

Display:

```text
Decision cutoff
09:20 GMT
```

Tooltip:

```text
Pilot assumption based on the EPEX SPOT GB DAA 1 day-ahead auction.
```

Do not make the cutoff editable.

---

# Decision context strip

Show:

```text
Decision: 15 Jan 2026 · 09:20 GMT
Delivery: 16 Jan 2026
Forecast published: 07:30 GMT
Forecast age: 1h 50m
```

The 07:30 value above is representative of the verified January schedule.

The rendered value must come from the API.

Do not hard-code it into UI logic.

---

# Charts

Use shadcn Charts / Recharts for standard charts.

Every chart must include:

- descriptive title
- unit
- explicit time meaning
- accessible tooltip
- no unexplained abbreviations
- no unnecessary animation
- responsive container with explicit height

---

## Forecast profile

Type:

```text
composed line + historical error band
```

Series:

- forecast line: blue
- lower band boundary: visually unobtrusive
- upper band boundary: visually unobtrusive
- band fill: light blue

Data:

```text
24 hourly targets
00:00 through 23:00
```

X-axis:

Prefer ticks every:

```text
3 hours
```

Example:

```text
00 03 06 09 12 15 18 21
```

Y-axis:

Display in GW where readability improves.

Backend remains MW.

Tooltip:

- delivery hour
- forecast MW/GW
- lower historical P90 band
- upper historical P90 band
- forecast publication time if useful

---

## Forecast vs actual

Two hourly lines:

- forecast: blue
- actual: charcoal

24 points/day.

Tooltip:

- target hour
- forecast
- actual
- signed error

---

## Signed error chart

Use vertical bars around zero.

Positive:

```text
red
over-forecast
```

Negative:

```text
teal
under-forecast
```

Include a clear zero reference line.

---

## Forecast evolution

X-axis:

```text
publishTime
```

Y-axis:

```text
forecast generation MW/GW
```

Show:

- every forecast vintage
- actual value as a horizontal reference if available
- 09:20 cutoff as vertical reference
- decision-selected vintage as stronger marker

A typical January target may show:

```text
02:30
04:30
07:30 selected
09:30 post-cutoff
12:25
15:30
18:30
22:30
```

Later vintages are analytical context only.

---

# Error heatmap

Do not add another chart library.

Implement as a CSS grid.

Dimensions:

```text
rows = 31 January decision dates
columns = 24 delivery hours
```

Columns:

```text
00 through 23
```

Label every hour if space permits.

On smaller widths, label logical intervals such as:

```text
00 03 06 09 12 15 18 21
```

Color mapping:

- strong positive = deeper red
- near zero = neutral
- strong negative = deeper teal

Tooltip must contain:

- decision date
- delivery date
- delivery hour
- forecast MW
- actual MW
- signed error MW

Provide a visible legend.

---

# Decision page composition

Recommended:

```text
Page header + date control
Decision context strip
4–5 metric cards
Forecast profile card
Methodology/source note
```

Metrics may include:

- average forecast
- peak forecast
- peak hour
- historical MAE
- historical P90 absolute error

---

# Accuracy page composition

Recommended:

```text
Page header
Accuracy metrics
Forecast vs actual
Signed error
31 × 24 error heatmap
Forecast evolution
Methodology note
```

Primary analytical elements:

- forecast vs actual
- heatmap

Do not give every section identical visual weight.

---

# Loading

Use skeletons shaped like the final layout.

Avoid full-screen spinners.

---

# Empty and error states

Example missing forecast:

```text
No decision-time forecast was available before the 09:20 cutoff for this delivery hour.
```

Contract error:

```text
The API returned data in an unexpected format.
```

Do not expose raw traces.

---

# Responsiveness

## >= 1280px

- 4–5 metric cards in one row
- wide charts
- full 24-column heatmap

## 768–1279px

- 2-column metric grid
- charts full width
- heatmap may scroll horizontally if needed

## < 768px

- single-column cards
- charts remain readable
- horizontal scroll allowed for heatmap
- simplify legends if required

---

# Accessibility

- WCAG AA text contrast
- visible focus states
- semantic headings
- no color-only error direction
- accessible names for controls
- accessible chart layer where supported
- heatmap cells expose date/hour/error text
- respect reduced-motion preferences

---

# Motion

Keep motion minimal.

Allowed:

```text
120–180ms control transitions
subtle hover/focus states
```

Avoid decorative or spring-based motion.

---

# Anti-patterns

Do not introduce:

- gradients
- glassmorphism
- neon palettes
- huge rounded cards
- marketing hero content
- decorative illustration
- 48-point half-hour forecast UI
- fake settlement-period labels for WINDFOR
- separate colors for every KPI
- duplicated table/chart views without a clear user purpose
