const periodsPerYear = new Map([
  ['daily', 365],
  ['weekly', 52],
  ['monthly', 12],
  ['annually', 1],
]);

function calculateRewards(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RangeError('Provide the calculation inputs as a JSON object.');
  }

  const { principal, apy, duration, durationUnit, compoundingFrequency, tokenPriceUsd } = input;
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new RangeError('Principal must be a positive number.');
  }
  if (!Number.isFinite(apy) || apy < 0) {
    throw new RangeError('APY must be a nonnegative number.');
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError('Duration must be a positive number.');
  }
  if (durationUnit !== 'days' && durationUnit !== 'years') {
    throw new RangeError('Duration unit must be days or years.');
  }
  const frequency = periodsPerYear.get(compoundingFrequency);
  if (!frequency) {
    throw new RangeError('Choose daily, weekly, monthly, or annual compounding.');
  }
  if (tokenPriceUsd !== undefined && (!Number.isFinite(tokenPriceUsd) || tokenPriceUsd < 0)) {
    throw new RangeError('Token price must be a nonnegative number.');
  }

  const durationYears = durationUnit === 'days' ? duration / 365 : duration;
  if (durationYears === 0) {
    throw new RangeError('Duration is too small to represent in years.');
  }
  const annualLogGrowth = Math.log1p(apy / 100);
  const rewardsAt = (years) => {
    const growth = Math.expm1(annualLogGrowth * years);
    if (Number.isFinite(growth)) return principal * growth;
    return Math.exp(Math.log(principal) + annualLogGrowth * years) - principal;
  };

  const rewards = rewardsAt(durationYears);
  const finalBalance = principal + rewards;
  const usd = tokenPriceUsd === undefined ? {} : {
    finalBalanceUsd: finalBalance * tokenPriceUsd,
    rewardsUsd: rewards * tokenPriceUsd,
  };
  if (![finalBalance, ...Object.values(usd)].every(Number.isFinite)) {
    throw new RangeError('The projected values are too large. Reduce the inputs and try again.');
  }

  const totalPeriods = durationYears * frequency;
  const stride = Math.max(1, Math.ceil(totalPeriods / 199));
  const series = [{ elapsedYears: 0, balance: principal }];
  for (let index = 1; index < 199; index++) {
    const elapsedYears = (index * stride) / frequency;
    if (elapsedYears >= durationYears) break;
    series.push({ elapsedYears, balance: principal + rewardsAt(elapsedYears) });
  }
  series.push({ elapsedYears: durationYears, balance: finalBalance });
  return { finalBalance, rewards, durationYears, series, ...usd };
}

module.exports = calculateRewards;
