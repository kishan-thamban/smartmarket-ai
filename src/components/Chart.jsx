/**
 * Chart.jsx — ForecastChart
 *
 * Recharts-based demand forecast visualisation.
 *
 * Fixes applied:
 *  - Accepts `metrics` prop ({ rmse, mape }) and renders them in a badge strip.
 *  - No longer reads custom properties off the data array (they were lost during
 *    JSON serialisation). Confidence bands come from per-row fields only.
 *  - `currentStock` reference line rendered when the prop is provided.
 *  - Safe against an empty or undefined `data` array.
 */

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Colour palette (matches Tailwind custom colours) ─────────────────────────
const OLIVE      = "#6B7D4F";
const OLIVE_SOFT = "#87986A";
const BEIGE_BAND = "#6B7D4F22"; // confidence band fill

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row        = payload[0]?.payload ?? {};
  const isForecast = row.predicted !== null;

  return (
    <div className="bg-white border border-olive/15 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[160px]">
      <p className="font-bold text-darkgray mb-2">{label}</p>

      {isForecast ? (
        <>
          <div className="flex justify-between gap-4 mb-1">
            <span className="text-darkgray/55">Predicted</span>
            <span className="font-bold text-olive">{row.predicted ?? row.actual} units</span>
          </div>
          {row.upper !== null && (
            <div className="flex justify-between gap-4 mb-1">
              <span className="text-darkgray/55">Upper (95%)</span>
              <span className="font-semibold text-darkgray">{row.upper}</span>
            </div>
          )}
          {row.lower !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-darkgray/55">Lower (95%)</span>
              <span className="font-semibold text-darkgray">{row.lower}</span>
            </div>
          )}
          <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-olive/70">Forecast</p>
        </>
      ) : (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-darkgray/55">Actual Sales</span>
            <span className="font-bold text-darkgray">{row.actual} units</span>
          </div>
          <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-darkgray/40">Historical</p>
        </>
      )}
    </div>
  );
}

// ── Custom dot — only shown on forecast points ─────────────────────────────

function ForecastDot(props) {
  const { cx, cy, payload } = props;
  if (payload?.predicted === null) return null;
  return <circle cx={cx} cy={cy} r={2.5} fill={OLIVE} stroke="white" strokeWidth={1} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ForecastChart({
  data         = [],
  currentStock = null,
  metrics      = { rmse: null, mape: null },
  source       = "lstm",
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-xs text-darkgray/40 italic">
        No forecast data available yet. Place some orders to generate sales history.
      </div>
    );
  }

  // ── Split data for separate series ────────────────────────────────────────
  const historicalData = data.filter((d) => d.actual !== null);
  const forecastData   = data.filter((d) => d.predicted !== null);

  // Recharts ComposedChart needs a single flat array.
  // We stitch with a "bridge" point so the line connects seamlessly.
  const bridgePoint = historicalData.length > 0
    ? { ...historicalData[historicalData.length - 1], predicted: historicalData[historicalData.length - 1].actual,
        upper: historicalData[historicalData.length - 1].actual,
        lower: historicalData[historicalData.length - 1].actual,
      }
    : null;

  const combinedData = bridgePoint
    ? [...historicalData, bridgePoint, ...forecastData]
    : [...historicalData, ...forecastData];

  const maxY = Math.max(
    ...combinedData.map((d) =>
      Math.max(d.actual ?? 0, d.upper ?? d.predicted ?? 0, currentStock ?? 0)
    ),
    10
  );

  const hasMetrics = metrics && (metrics.rmse !== null || metrics.mape !== null);

  return (
    <div className="w-full h-full flex flex-col gap-3">

      {/* Accuracy metric badges — FIX: rendered from API metrics prop */}
      {hasMetrics && (
        <div className="flex flex-wrap gap-2">
          {metrics.rmse !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-lg text-[10px] font-bold text-purple-600">
              RMSE: {typeof metrics.rmse === "number" ? metrics.rmse.toFixed(2) : metrics.rmse}
              <span className="font-normal text-purple-400">root mean sq. error</span>
            </span>
          )}
          {metrics.mape !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-lg text-[10px] font-bold text-purple-600">
              MAPE: {typeof metrics.mape === "number" ? metrics.mape.toFixed(2) : metrics.mape}%
              <span className="font-normal text-purple-400">mean abs. % error</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-olive/8 border border-olive/15 rounded-lg text-[10px] font-bold text-olive/70">
            {source === "lstm"
              ? "JS LSTM · Neural Network"
              : "JS Exponential Smoothing"}
            {" "}· out-of-sample evaluation
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={combinedData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#6B7D4F18" vertical={false} />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#2F2F2F80", fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{ fontSize: 9, fill: "#2F2F2F80", fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={30}
              domain={[0, Math.ceil(maxY * 1.15)]}
              allowDecimals={false}
            />

            <Tooltip content={<ChartTooltip />} />

            {/* Current stock reference line */}
            {currentStock !== null && currentStock > 0 && (
              <ReferenceLine
                y={currentStock}
                stroke="#EF4444"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{
                  value: `Stock: ${currentStock}`,
                  position: "insideTopRight",
                  fill: "#EF4444",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              />
            )}

            {/* Confidence band (area between upper and lower confidence) */}
            <Area
              dataKey="upper"
              fill={BEIGE_BAND}
              stroke="none"
              legendType="none"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              dataKey="lower"
              fill="white"
              stroke="none"
              legendType="none"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />

            {/* Historical sales line */}
            <Line
              type="monotone"
              dataKey={(d) => (d.actual !== null ? d.actual : undefined)}
              name="Historical Sales"
              stroke={OLIVE_SOFT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: OLIVE_SOFT, stroke: "white", strokeWidth: 2 }}
              connectNulls={false}
              legendType="line"
            />

            {/* Forecast line */}
            <Line
              type="monotone"
              dataKey={(d) => (d.predicted !== null ? (d.predicted ?? d.actual) : undefined)}
              name="Forecast"
              stroke={OLIVE}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={<ForecastDot />}
              activeDot={{ r: 4, fill: OLIVE, stroke: "white", strokeWidth: 2 }}
              connectNulls
              legendType="line"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast summary strip */}
      {forecastData.length > 0 && (
        <div className="flex flex-wrap gap-4 text-[10px] text-darkgray/55 pt-1">
          <span>
            Horizon: <strong className="text-darkgray">{forecastData.length} days</strong>
          </span>
          <span>
            Peak predicted:{" "}
            <strong className="text-olive">
              {Math.max(...forecastData.map((d) => d.predicted ?? d.actual ?? 0))} units
            </strong>
          </span>
          <span>
            30-day total:{" "}
            <strong className="text-olive">
              {forecastData.reduce((s, d) => s + (d.predicted ?? d.actual ?? 0), 0)} units
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}