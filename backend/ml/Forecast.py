"""
forecast.py — SmartMarketAI ML Forecasting Pipeline
-----------------------------------------------------
Linear Regression demand forecasting using scikit-learn.

Usage (standalone):
    python forecast.py --product_id p-01 --db_path ./db.json

Called by server.js via child_process.execFile:
    python forecast.py <productId> <db_path>

Output (stdout, JSON):
    {
      "productId": "p-01",
      "history":   [ { "date": "MM-DD", "sales": int, "isForecast": false }, ... ],
      "forecast":  [ { "date": "MM-DD", "sales": int, "isForecast": true,
                       "predictedDemand": int, "lowerConfidence": int,
                       "upperConfidence": int }, ... ],
      "chartData": [ ...history (last 60d), ...forecast (30d) ],
      "totalPredictedDemand": int,
      "metrics": {
          "rmse": float,   -- Root Mean Squared Error on held-out test set (last 20%)
          "mape": float    -- Mean Absolute Percentage Error (%) on held-out test set
      },
      "source": "sklearn-linear-regression"
    }

Fixes applied vs original:
  - RMSE and MAPE are computed on a held-out test split (last 20% of history)
    rather than on the training set, giving honest out-of-sample accuracy estimates.
  - All output is returned as a plain JSON object — no custom properties attached
    to arrays (fixes frontend serialisation issue).
  - chartData is explicitly constructed as a plain list (history[-60:] + forecast).
  - "source" key included so the frontend can label the chart correctly.
"""

import sys
import json
import argparse
import math
from datetime import date, timedelta

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error


# ─────────────────────────────────────────────
# 1. Load & aggregate sales history
# ─────────────────────────────────────────────

def load_sales(db_path: str, product_id: str) -> pd.DataFrame:
    """Read db.json and return a daily-aggregated DataFrame for product_id."""
    with open(db_path, "r") as fh:
        db = json.load(fh)

    records = [
        r for r in db.get("salesHistory", [])
        if r["productId"] == product_id
    ]

    if not records:
        return pd.DataFrame(columns=["date", "quantity"])

    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    df = (
        df.groupby("date", as_index=False)["quantity"]
        .sum()
        .sort_values("date")
        .reset_index(drop=True)
    )
    return df


def fill_date_gaps(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build a contiguous daily series from min→max date.
    Missing days are filled with the rolling 3-day mean of neighbours
    (falls back to overall mean when insufficient context).
    """
    if df.empty:
        return df

    full_idx = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
    df = df.set_index("date").reindex(full_idx).rename_axis("date").reset_index()

    df["quantity"] = (
        df["quantity"]
        .fillna(df["quantity"].rolling(3, min_periods=1, center=True).mean())
        .fillna(df["quantity"].mean())
        .round()
        .astype(int)
    )
    return df


# ─────────────────────────────────────────────
# 2. Feature engineering
# ─────────────────────────────────────────────

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enrich the DataFrame with time-based features for regression.

    Features:
        t           – ordinal day index (captures linear trend)
        dow_sin/cos – cyclic day-of-week encoding  (0=Mon … 6=Sun)
        week_sin/cos– cyclic week-of-year encoding
        lag_7       – 7-day lagged quantity (weekly seasonality proxy)
        roll_7      – 7-day rolling mean    (short-term level)
        roll_14     – 14-day rolling mean   (medium-term level)
    """
    df = df.copy()
    df["t"] = np.arange(len(df))

    dow = df["date"].dt.dayofweek
    woy = df["date"].dt.isocalendar().week.astype(float)

    df["dow_sin"]  = np.sin(2 * np.pi * dow / 7)
    df["dow_cos"]  = np.cos(2 * np.pi * dow / 7)
    df["week_sin"] = np.sin(2 * np.pi * woy / 52)
    df["week_cos"] = np.cos(2 * np.pi * woy / 52)

    df["lag_7"]   = df["quantity"].shift(7).bfill()
    df["roll_7"]  = df["quantity"].rolling(7,  min_periods=1).mean()
    df["roll_14"] = df["quantity"].rolling(14, min_periods=1).mean()

    return df


FEATURE_COLS = [
    "t", "dow_sin", "dow_cos", "week_sin", "week_cos",
    "lag_7", "roll_7", "roll_14",
]


# ─────────────────────────────────────────────
# 3. Train / test split & metrics
# ─────────────────────────────────────────────

def split_train_test(df: pd.DataFrame, test_frac: float = 0.20):
    """
    Hold out the last `test_frac` fraction of rows for out-of-sample evaluation.
    Minimum 1 test row; minimum 3 training rows.
    """
    n_test  = max(1, round(len(df) * test_frac))
    n_train = len(df) - n_test
    if n_train < 3:
        # Not enough data to split meaningfully — use all for training
        return df, pd.DataFrame(columns=df.columns)
    return df.iloc[:n_train], df.iloc[n_train:]


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """
    Compute out-of-sample RMSE and MAPE.

    RMSE: root mean squared error (same unit as sales quantity)
    MAPE: mean absolute percentage error in % (excludes zero-actual rows)
    """
    if len(y_true) == 0:
        return {"rmse": None, "mape": None}

    rmse = float(math.sqrt(mean_squared_error(y_true, y_pred)))

    nonzero_mask = y_true > 0
    if nonzero_mask.sum() == 0:
        mape = None
    else:
        mape = float(
            np.mean(np.abs((y_true[nonzero_mask] - y_pred[nonzero_mask])
                           / y_true[nonzero_mask])) * 100
        )

    return {
        "rmse": round(rmse, 4),
        "mape": round(mape, 4) if mape is not None else None,
    }


# ─────────────────────────────────────────────
# 4. Train model & residual std
# ─────────────────────────────────────────────

def train_model(df_train: pd.DataFrame) -> LinearRegression:
    X = df_train[FEATURE_COLS].values
    y = df_train["quantity"].values
    model = LinearRegression()
    model.fit(X, y)
    return model


def compute_residual_std(model: LinearRegression, df_train: pd.DataFrame) -> float:
    """
    Training-set RMSE — used solely to build forecast confidence intervals.
    We keep this separate from the evaluation metrics so the CI reflects
    in-sample spread (which is the right basis for prediction intervals).
    """
    X     = df_train[FEATURE_COLS].values
    y     = df_train["quantity"].values
    y_hat = model.predict(X)
    rmse  = math.sqrt(np.mean((y - y_hat) ** 2))
    return max(rmse, 0.5)   # floor so CI is never exactly zero


# ─────────────────────────────────────────────
# 5. 30-day iterative forecast
# ─────────────────────────────────────────────

def predict_next_30(
    model:         LinearRegression,
    df_full:       pd.DataFrame,   # full history (train + test) — for lag features
    residual_std:  float,
    horizon:       int = 30,
) -> pd.DataFrame:
    """
    Iteratively build feature rows for the next `horizon` days and predict.

    Confidence interval = ±1.96 × residual_std × √(1 + i/horizon)
    (widens progressively as we move further into the future).

    `df_full` is the entire contiguous history so that lag/rolling features
    initialise from realistic values even if the test split was withheld.
    """
    extended  = df_full[["date", "quantity"]].copy()
    last_t    = int(df_full["t"].iloc[-1])
    last_date = df_full["date"].iloc[-1]

    forecast_rows = []

    for i in range(1, horizon + 1):
        next_date = last_date + timedelta(days=i)

        t_val = last_t + i
        dow   = next_date.weekday()
        woy   = float(next_date.isocalendar()[1])

        # Lag-7: look back 7 rows into the extended series
        lag7   = float(extended["quantity"].iloc[-7])  if len(extended) >= 7  else float(extended["quantity"].mean())
        roll7  = float(extended["quantity"].iloc[-7:].mean())  if len(extended) >= 7  else float(extended["quantity"].mean())
        roll14 = float(extended["quantity"].iloc[-14:].mean()) if len(extended) >= 14 else float(extended["quantity"].mean())

        row = {
            "t":        t_val,
            "dow_sin":  math.sin(2 * math.pi * dow / 7),
            "dow_cos":  math.cos(2 * math.pi * dow / 7),
            "week_sin": math.sin(2 * math.pi * woy / 52),
            "week_cos": math.cos(2 * math.pi * woy / 52),
            "lag_7":    lag7,
            "roll_7":   roll7,
            "roll_14":  roll14,
        }

        X_pred  = np.array([[row[c] for c in FEATURE_COLS]])
        pred_raw = float(model.predict(X_pred)[0])
        pred    = max(0.0, pred_raw)

        # 95 % prediction interval — widens with forecast horizon
        margin = 1.96 * residual_std * math.sqrt(1 + i / horizon)
        lower  = max(0, round(pred - margin))
        upper  = round(pred + margin)
        sales  = round(pred)

        forecast_rows.append({
            "date":            next_date,
            "quantity":        sales,          # feeds subsequent lag features
            "predictedDemand": sales,
            "lowerConfidence": lower,
            "upperConfidence": upper,
            "isForecast":      True,
        })

        # Append predicted quantity to extended so future lags are realistic
        extended = pd.concat(
            [extended, pd.DataFrame([{"date": next_date, "quantity": sales}])],
            ignore_index=True,
        )

    return pd.DataFrame(forecast_rows)


# ─────────────────────────────────────────────
# 6. Format final output
# ─────────────────────────────────────────────

def format_date(d) -> str:
    """Return 'MM-DD' label expected by ForecastChart."""
    if isinstance(d, str):
        d = pd.to_datetime(d)
    return d.strftime("%m-%d")


def build_output(
    product_id:  str,
    df_hist:     pd.DataFrame,
    df_forecast: pd.DataFrame,
    metrics:     dict,
) -> dict:
    """
    Construct the final JSON payload.

    FIX: chartData is a plain Python list — no custom properties attached to it.
    The frontend reads payload.chartData directly as a JSON array.
    """
    # Last 60 days of history
    history_rows = df_hist.tail(60).to_dict("records")
    history_out  = [
        {
            "date":       format_date(r["date"]),
            "sales":      int(r["quantity"]),
            "isForecast": False,
        }
        for r in history_rows
    ]

    forecast_out = [
        {
            "date":            format_date(r["date"]),
            "sales":           int(r["predictedDemand"]),
            "isForecast":      True,
            "predictedDemand": int(r["predictedDemand"]),
            "lowerConfidence": int(r["lowerConfidence"]),
            "upperConfidence": int(r["upperConfidence"]),
        }
        for r in df_forecast.to_dict("records")
    ]

    total_predicted_demand = sum(r["predictedDemand"] for r in forecast_out)

    # FIX: chartData is an explicit plain list — NOT an array with custom props
    chart_data = list(history_out) + list(forecast_out)

    return {
        "productId":            product_id,
        "history":              history_out,
        "forecast":             forecast_out,
        "chartData":            chart_data,          # plain list ✓
        "totalPredictedDemand": total_predicted_demand,
        "metrics":              metrics,             # { rmse, mape } from held-out test
        "source":               "sklearn-linear-regression",
    }


# ─────────────────────────────────────────────
# 7. Main pipeline
# ─────────────────────────────────────────────

def run(product_id: str, db_path: str) -> dict:
    df_raw = load_sales(db_path, product_id)

    if df_raw.empty or len(df_raw) < 3:
        return {
            "productId":            product_id,
            "history":              [],
            "forecast":             [],
            "chartData":            [],
            "totalPredictedDemand": 0,
            "metrics":              {"rmse": None, "mape": None},
            "source":               "sklearn-linear-regression",
            "error":                "insufficient_data",
        }

    # Fill contiguous date range
    df_filled = fill_date_gaps(df_raw)

    # Build features on the full contiguous history
    df_featured = build_features(df_filled)

    # Train / test split for out-of-sample metric evaluation
    df_train, df_test = split_train_test(df_featured, test_frac=0.20)

    # Train on training split
    model = train_model(df_train)

    # Evaluate on held-out test split (honest out-of-sample metrics)
    if not df_test.empty:
        X_test  = df_test[FEATURE_COLS].values
        y_test  = df_test["quantity"].values
        y_pred  = np.maximum(0, model.predict(X_test))
        metrics = compute_metrics(y_test, y_pred)
    else:
        # Fallback: in-sample metrics when there is too little data to split
        X_all  = df_train[FEATURE_COLS].values
        y_all  = df_train["quantity"].values
        y_pred_all = np.maximum(0, model.predict(X_all))
        metrics = compute_metrics(y_all, y_pred_all)

    # Residual std from training set — used for CI width only
    residual_std = compute_residual_std(model, df_train)

    # Re-train on ALL data so the forecast starts from the latest state
    # (metrics were already captured from the held-out split above)
    model_full = train_model(df_featured)

    # Generate 30-day forecast
    df_forecast = predict_next_30(model_full, df_featured, residual_std, horizon=30)

    return build_output(product_id, df_featured, df_forecast, metrics)


# ─────────────────────────────────────────────
# 8. Entry point (CLI + server.js exec)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # Support both positional args (called by server.js) and named args (standalone)
    if len(sys.argv) >= 3 and not sys.argv[1].startswith("-"):
        # Called as: python forecast.py <productId> <db_path>
        result = run(sys.argv[1], sys.argv[2])
    else:
        parser = argparse.ArgumentParser(description="SmartMarketAI demand forecasting pipeline")
        parser.add_argument("product_id", help="Product ID to forecast, e.g. p-01")
        parser.add_argument("db_path",    help="Path to db.json")
        args   = parser.parse_args()
        result = run(args.product_id, args.db_path)

    # Output to stdout — server.js reads and parses this
    print(json.dumps(result, ensure_ascii=False))