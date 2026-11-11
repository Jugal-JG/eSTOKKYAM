const assert = require('node:assert/strict');
const { test } = require('node:test');
const calculateRewards = require('./calculateRewards');

const example = {
  principal: 1000,
  apy: 5,
  duration: 365,
  durationUnit: 'days',
  compoundingFrequency: 'daily',
};

test('effective APY gives the same annual result at all frequencies', () => {
  for (const [compoundingFrequency, count] of [
    ['daily', 184], ['weekly', 53], ['monthly', 13], ['annually', 2],
  ]) {
    const result = calculateRewards({ ...example, compoundingFrequency });
    assert.equal(result.durationYears, 1);
    assert.equal(result.finalBalance, 1050);
    assert.equal(result.rewards, 50);
    assert.equal(result.series.length, count);
    assert.deepEqual(result.series[0], { elapsedYears: 0, balance: 1000 });
    assert.deepEqual(result.series.at(-1), { elapsedYears: 1, balance: 1050 });
  }
});

test('fractional years retain the exact final chart point and support USD totals', () => {
  const result = calculateRewards({
    ...example, duration: 1.5, durationUnit: 'years',
    compoundingFrequency: 'annually', tokenPriceUsd: 2,
  });
  assert.ok(Math.abs(result.finalBalance - 1075.9298304257578) < 1e-9);
  assert.equal(result.finalBalanceUsd, result.finalBalance * 2);
  assert.equal(result.rewardsUsd, result.rewards * 2);
  assert.deepEqual(result.series.map((point) => point.elapsedYears), [0, 1, 1.5]);
});

test('zero APY produces a flat series and zero rewards', () => {
  const result = calculateRewards({ ...example, apy: 0, tokenPriceUsd: 0 });
  assert.equal(result.rewards, 0);
  assert.equal(result.finalBalanceUsd, 0);
  assert.ok(result.series.every((point) => point.balance === 1000));
  assert.equal(calculateRewards(example).finalBalanceUsd, undefined);
});

test('rejects invalid inputs and nonfinite projections', () => {
  for (const invalid of [
    { principal: 0 }, { principal: '1000' }, { principal: NaN }, { apy: -1 },
    { apy: Infinity }, { duration: 0 }, { durationUnit: 'months' },
    { compoundingFrequency: 'hourly' }, { tokenPriceUsd: null }, { tokenPriceUsd: -1 },
    { duration: Number.MIN_VALUE }, { duration: Number.MAX_VALUE }, { tokenPriceUsd: Number.MAX_VALUE },
  ]) {
    assert.throws(() => calculateRewards({ ...example, ...invalid }), RangeError);
  }
  assert.throws(() => calculateRewards(null), RangeError);
});
