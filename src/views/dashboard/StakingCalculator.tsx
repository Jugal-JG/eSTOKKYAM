import { FormEvent, PointerEvent, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

type Point = { elapsedYears: number; balance: number };
type Projection = {
  finalBalance: number;
  rewards: number;
  durationYears: number;
  series: Point[];
  finalBalanceUsd?: number;
  rewardsUsd?: number;
};

const numericFields = [
  { name: "principal", label: "Principal (tokens)", positive: true },
  { name: "apy", label: "APY (%)", positive: false },
  { name: "duration", label: "Duration", positive: true },
  { name: "tokenPriceUsd", label: "Token price (USD, optional)", positive: false },
] as const;
type Field = typeof numericFields[number]["name"];
const frequencies = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", annually: "Annually" };
const tokens = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 10 });
const usd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

function GrowthChart({ series, durationYears }: { series: Point[]; durationYears: number }) {
  const [selected, setSelected] = useState(series.length - 1);
  const start = series[0].balance;
  const span = series[series.length - 1].balance - start;
  const x = (point: Point) => 10 + (point.elapsedYears / durationYears) * 580;
  const y = (point: Point) => span ? 140 - ((point.balance - start) / span) * 120 : 80;
  const point = series[selected];

  function inspectPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * 600;
    setSelected(series.reduce((closest, candidate, index) =>
      Math.abs(x(candidate) - pointerX) < Math.abs(x(series[closest]) - pointerX)
        ? index : closest, 0));
  }

  return (
    <Box>
      <Typography variant="subtitle1" component="h3">Projected balance over time</Typography>
      <Box
        component="svg"
        viewBox="0 0 600 160"
        preserveAspectRatio="none"
        aria-hidden="true"
        sx={{ width: "100%", height: { xs: 125, sm: 160 }, color: "primary.main", display: "block" }}
        onPointerMove={(event) => {
          if (event.pointerType === "touch" && !event.buttons) return;
          inspectPointer(event);
        }}
        onPointerDown={inspectPointer}
      >
        <line x1="10" y1="150" x2="590" y2="150" stroke="currentColor" opacity=".35" />
        <polyline fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke"
          points={series.map((entry) => `${x(entry)},${y(entry)}`).join(" ")} />
        <line x1={x(point)} y1={y(point)} x2={x(point)} y2="150" stroke="currentColor" opacity=".5" />
        <circle cx={x(point)} cy={y(point)} r="5" fill="currentColor" />
      </Box>
      <Box
        component="input"
        type="range"
        min={0}
        max={series.length - 1}
        value={selected}
        onChange={(event) => setSelected(Number(event.currentTarget.value))}
        aria-label="Inspect growth chart"
        aria-valuetext={`${tokens.format(point.elapsedYears)} years, ${tokens.format(point.balance)} tokens`}
        sx={{ width: "100%", m: 0, accentColor: "primary.main" }}
      />
      <Typography variant="body2" color="text.secondary">
        {tokens.format(point.elapsedYears)} years · {tokens.format(point.balance)} tokens
      </Typography>
    </Box>
  );
}

export default function StakingCalculator() {
  const [values, setValues] = useState<Record<Field, string>>({
    principal: "", apy: "", duration: "", tokenPriceUsd: "",
  });
  const [durationUnit, setDurationUnit] = useState("days");
  const [compoundingFrequency, setCompoundingFrequency] = useState("daily");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Projection>();

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const errors: Partial<Record<Field, string>> = {};
    for (const { name, positive } of numericFields) {
      const raw = values[name].trim();
      if (name === "tokenPriceUsd" && raw === "") continue;
      const number = Number(raw);
      if (raw === "" || !Number.isFinite(number) || number < 0 || (positive && number === 0)) {
        errors[name] = positive ? "Enter a number greater than zero." : "Enter zero or a positive number.";
      }
    }
    setFieldErrors(errors);
    setError("");
    setResult(undefined);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      const response = await fetch("/api/calculate-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          principal: Number(values.principal),
          apy: Number(values.apy),
          duration: Number(values.duration),
          durationUnit,
          compoundingFrequency,
          ...(values.tokenPriceUsd.trim() && { tokenPriceUsd: Number(values.tokenPriceUsd) }),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Could not calculate rewards. Try again.");
      }
      setResult(await response.json());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not calculate rewards. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper component="section" aria-labelledby="staking-title" variant="outlined"
      sx={{ maxWidth: 1400, mx: "auto", my: 3, width: "calc(100% - 32px)", boxSizing: "border-box", p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Typography id="staking-title" variant="h5" component="h2">Staking rewards calculator</Typography>
        <Box component="form" onSubmit={calculate} noValidate>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {numericFields.map(({ name, label }) => (
              <TextField key={name} name={name} label={label} type="number"
                required={name !== "tokenPriceUsd"} inputProps={{ min: 0, step: "any" }}
                value={values[name]} error={Boolean(fieldErrors[name])} helperText={fieldErrors[name]}
                onChange={(event) => {
                  setValues({ ...values, [name]: event.target.value });
                  setFieldErrors({ ...fieldErrors, [name]: undefined });
                }}
              />
            ))}
            <TextField select label="Duration unit" value={durationUnit} onChange={(event) => setDurationUnit(event.target.value)}>
              <MenuItem value="days">Days</MenuItem>
              <MenuItem value="years">Years</MenuItem>
            </TextField>
            <TextField select label="Compounding frequency" value={compoundingFrequency}
              helperText="At a fixed APY, frequency changes the chart intervals."
              onChange={(event) => setCompoundingFrequency(event.target.value)}>
              {Object.entries(frequencies).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
          </Box>
          <Button type="submit" variant="contained" disabled={loading} sx={{ mt: 2 }}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {loading ? "Calculating…" : "Calculate rewards"}
          </Button>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {result && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 4 }} role="status">
              <Box>
                <Typography variant="body2" color="text.secondary">Projected final balance</Typography>
                <Typography variant="h6">{tokens.format(result.finalBalance)} tokens</Typography>
                {result.finalBalanceUsd !== undefined && <Typography>{usd.format(result.finalBalanceUsd)}</Typography>}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Rewards earned</Typography>
                <Typography variant="h6">{tokens.format(result.rewards)} tokens</Typography>
                {result.rewardsUsd !== undefined && <Typography>{usd.format(result.rewardsUsd)}</Typography>}
              </Box>
            </Stack>
            <GrowthChart series={result.series} durationYears={result.durationYears} />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
