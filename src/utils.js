/**
 * Extract probability value from odds object
 * @param {Object|number} odds - The odds object or number
 * @returns {number|null} - The probability value (0-1) or null if invalid
 */
export const extractProbability = (odds) => {
  if (!odds || typeof odds !== 'object') {
    if (typeof odds === 'number') {
      return odds >= 0 && odds <= 1 ? odds : odds / 100;
    }
    return null;
  }

  if (odds.error) {
    return null;
  }

  if (odds.winProbability !== undefined) {
    const prob = odds.winProbability;
    if (typeof prob === 'number') {
      return prob >= 0 && prob <= 1 ? prob : prob / 100;
    }
  }

  if (odds.odds !== undefined) {
    const oddsValue = odds.odds;
    if (typeof oddsValue === 'number') {
      return oddsValue >= 0 && oddsValue <= 1 ? oddsValue : oddsValue / 100;
    }
  }

  const numericValues = Object.values(odds)
    .filter(v => v !== null && v !== undefined && typeof v === 'number')
    .slice(0, 1);

  if (numericValues.length > 0) {
    const value = numericValues[0];
    return value >= 0 && value <= 1 ? value : value / 100;
  }

  return null;
};

/**
 * Generate all combinations of k items from an array
 * @param {Array} arr - The array to generate combinations from
 * @param {number} k - The number of items in each combination
 * @returns {Array} - Array of combinations
 */
export const combinations = (arr, k) => {
  if (k === 0) return [[]];
  if (k > arr.length) return [];

  const results = [];
  const generate = (combo, start) => {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      generate(combo, i + 1);
      combo.pop();
    }
  };
  generate([], 0);
  return results;
};

/**
 * Generate all permutations of an array
 * @param {Array} arr - The array to generate permutations from
 * @returns {Array} - Array of permutations
 */
export const permutations = (arr) => {
  if (arr.length <= 1) return [arr];
  const results = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = permutations(rest);
    for (const perm of perms) {
      results.push([arr[i], ...perm]);
    }
  }
  return results;
};

