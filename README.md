# DeFi Dashboard

Use Node.js 18 or later. From the repository root, install dependencies and start the dashboard and API.

```sh
npm install
npm start
```

Open http://localhost:3000/dashboard. The React development server proxies relative API calls to Express on port 5025. For production, run `npm run build`, then start `npm run server` with `NODE_ENV=production`. Express serves the root build directory.

## Staking rewards calculator

The dashboard calculator estimates token growth from a fixed effective annual percentage yield (APY). Enter an optional fixed USD price per token to see equivalent dollar totals.

Send a JSON request to `POST /api/calculate-rewards`:

```json
{
  "principal": 1000,
  "apy": 5,
  "duration": 365,
  "durationUnit": "days",
  "compoundingFrequency": "daily",
  "tokenPriceUsd": 2
}
```

Use `days` or `years` and `daily`, `weekly`, `monthly`, or `annually`. Principal and duration must be positive. APY and optional token price must be nonnegative. Numbers must be finite and fractional durations are supported.

The response contains `finalBalance`, `rewards`, `durationYears`, and `series`, an array of objects with `elapsedYears` and `balance`. It includes `finalBalanceUsd` and `rewardsUsd` when a price is provided. The example returns 1,050 tokens and 50 tokens in rewards, equivalent to $2,100 and $100 at the supplied price. Invalid inputs and projections outside the numeric range return HTTP 400 with a JSON `message`. Unexpected errors return HTTP 500.

## Architecture and trade-offs

The dashboard component owns the form, loading and error states, and chart. The Express route calls a standalone service for input validation and calculations. Keeping the math in one place gives the chart and totals the same source of truth and lets the unit tests run without a browser or HTTP server. The API is stateless because each projection can be calculated from its request.

Effective APY makes yields directly comparable across frequencies. At a fixed APY, frequency controls the chart sampling cadence. For long durations, the point limit keeps responses and rendering bounded at the cost of skipping some intermediate periods.

## Math and tests

The model uses 365 days per year and balance = principal × (1 + APY / 100)^years. A fixed effective APY already includes compounding. The selected frequency determines where the chart samples the curve, using 365, 52, 12, or 1 periods per year. Long series skip intermediate periods and retain the initial balance and exact endpoint, with at most 200 points. The calculation service has no HTTP or UI dependencies. The balance calculation is O(1), and a chart with k points takes O(k) time and space.

The assignment's formula is `A = P × (1 + r/n)^(n × t)`, where `r` is the nominal annual rate as a decimal. For an effective APY of `y` as a decimal, the equivalent rate per period is `r/n = (1 + y)^(1/n) − 1`. Substituting this gives `A = P × (1 + y)^t`, which is the form implemented by the service.

```sh
node --test server/calculateRewards.test.js
npm run build
```
