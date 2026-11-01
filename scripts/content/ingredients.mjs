// Nutrition per 100 g (edible portion) used to calculate recipe macros.
// Values: USDA FoodData Central (SR Legacy) unless noted; Indian staples from IFCT 2017 or
// typical Indian pack labels where marked. Real foods vary by brand and variety, so recipe
// numbers are estimates and the site says so.
// [kcal, protein g, carbs g, fat g]
export const INGREDIENTS = {
  moong_dal:      { name: 'Moong dal (split, dry)', per100: [348, 24.5, 59.9, 1.2], src: 'IFCT 2017' },
  whole_moong:    { name: 'Whole moong (dry)', per100: [347, 23.9, 62.6, 1.2], src: 'USDA' },
  masoor_dal:     { name: 'Masoor dal (dry)', per100: [358, 23.9, 63.1, 2.2], src: 'USDA' },
  chana_dry:      { name: 'Kabuli chana (dry)', per100: [364, 19.3, 60.7, 6.0], src: 'USDA' },
  chana_cooked:   { name: 'Chickpeas (boiled)', per100: [164, 8.9, 27.4, 2.6], src: 'USDA' },
  rajma_dry:      { name: 'Rajma (dry)', per100: [337, 22.5, 61.3, 1.1], src: 'USDA' },
  soya_chunks:    { name: 'Soya chunks (dry)', per100: [345, 52.0, 33.0, 0.5], src: 'pack label' },
  tofu:           { name: 'Firm tofu', per100: [144, 17.3, 2.8, 8.7], src: 'USDA' },
  paneer:         { name: 'Paneer', per100: [265, 18.3, 1.2, 20.8], src: 'pack label' },
  curd:           { name: 'Curd (whole milk)', per100: [61, 3.5, 4.7, 3.3], src: 'USDA' },
  hung_curd:      { name: 'Hung curd / Greek yogurt (low fat)', per100: [73, 10.0, 3.9, 1.9], src: 'USDA' },
  toned_milk:     { name: 'Toned milk', per100: [58, 3.1, 4.7, 3.0], src: 'pack label' },
  whey:           { name: 'Whey protein', per100: [400, 78.0, 8.0, 6.0], src: 'typical label' },
  oats:           { name: 'Rolled oats', per100: [379, 13.2, 67.7, 6.5], src: 'USDA' },
  besan:          { name: 'Besan', per100: [387, 22.4, 57.8, 6.7], src: 'USDA' },
  atta:           { name: 'Whole wheat atta', per100: [340, 13.2, 72.0, 2.5], src: 'USDA' },
  rice:           { name: 'White rice (raw)', per100: [365, 7.1, 80.0, 0.7], src: 'USDA' },
  brown_rice:     { name: 'Brown rice (raw)', per100: [367, 7.5, 76.2, 3.2], src: 'USDA' },
  poha:           { name: 'Poha (dry)', per100: [346, 6.6, 77.3, 1.2], src: 'IFCT 2017' },
  sattu:          { name: 'Sattu (roasted chana flour)', per100: [380, 22.0, 60.0, 5.5], src: 'approximate' },
  bread_ww:       { name: 'Whole wheat bread', per100: [252, 12.5, 42.7, 3.5], src: 'USDA' },
  peanuts:        { name: 'Peanuts', per100: [567, 25.8, 16.1, 49.2], src: 'USDA' },
  peanut_butter:  { name: 'Peanut butter', per100: [588, 25.1, 19.6, 50.4], src: 'USDA' },
  almonds:        { name: 'Almonds', per100: [579, 21.2, 21.6, 49.9], src: 'USDA' },
  chia:           { name: 'Chia seeds', per100: [486, 16.5, 42.1, 30.7], src: 'USDA' },
  pumpkin_seeds:  { name: 'Pumpkin seeds', per100: [559, 30.2, 10.7, 49.1], src: 'USDA' },
  makhana:        { name: 'Makhana', per100: [332, 15.4, 64.5, 2.0], src: 'USDA (lotus seeds, dried)' },
  egg:            { name: 'Whole egg', per100: [143, 12.6, 0.7, 9.5], src: 'USDA' },
  egg_white:      { name: 'Egg white', per100: [52, 10.9, 0.7, 0.2], src: 'USDA' },
  ghee:           { name: 'Ghee', per100: [876, 0.3, 0, 99.5], src: 'USDA' },
  oil:            { name: 'Cooking oil', per100: [884, 0, 0, 100], src: 'USDA' },
  onion:          { name: 'Onion', per100: [40, 1.1, 9.3, 0.1], src: 'USDA' },
  tomato:         { name: 'Tomato', per100: [18, 0.9, 3.9, 0.2], src: 'USDA' },
  spinach:        { name: 'Spinach', per100: [23, 2.9, 3.6, 0.4], src: 'USDA' },
  capsicum:       { name: 'Capsicum', per100: [20, 0.9, 4.6, 0.2], src: 'USDA' },
  cucumber:       { name: 'Cucumber', per100: [15, 0.7, 3.6, 0.1], src: 'USDA' },
  carrot:         { name: 'Carrot', per100: [41, 0.9, 9.6, 0.2], src: 'USDA' },
  peas:           { name: 'Green peas', per100: [81, 5.4, 14.5, 0.4], src: 'USDA' },
  beans:          { name: 'French beans', per100: [31, 1.8, 7.0, 0.2], src: 'USDA' },
  cabbage:        { name: 'Cabbage', per100: [25, 1.3, 5.8, 0.1], src: 'USDA' },
  mushroom:       { name: 'Mushroom', per100: [22, 3.1, 3.3, 0.3], src: 'USDA' },
  corn:           { name: 'Sweet corn', per100: [86, 3.3, 18.7, 1.4], src: 'USDA' },
  pomegranate:    { name: 'Pomegranate seeds', per100: [83, 1.7, 18.7, 1.2], src: 'USDA' },
  lemon:          { name: 'Lemon juice', per100: [22, 0.4, 6.9, 0.2], src: 'USDA' },
  banana:         { name: 'Banana', per100: [89, 1.1, 22.8, 0.3], src: 'USDA' },
  apple:          { name: 'Apple', per100: [52, 0.3, 13.8, 0.2], src: 'USDA' },
  honey:          { name: 'Honey', per100: [304, 0.3, 82.4, 0], src: 'USDA' },
  cocoa:          { name: 'Cocoa powder (unsweetened)', per100: [228, 19.6, 57.9, 13.7], src: 'USDA' },
  free:           { name: 'Spices and herbs', per100: [0, 0, 0, 0], src: 'counted as zero' },
};

export function macrosFor(items, servings = 1) {
  const t = [0, 0, 0, 0];
  for (const it of items) {
    const ing = INGREDIENTS[it.key];
    if (!ing) throw new Error(`Unknown ingredient ${it.key}`);
    const g = it.g || 0;
    ing.per100.forEach((v, i) => { t[i] += (v * g) / 100; });
  }
  return {
    calories: Math.round(t[0] / servings),
    protein_g: Math.round((t[1] / servings) * 10) / 10,
    carbs_g: Math.round((t[2] / servings) * 10) / 10,
    fat_g: Math.round((t[3] / servings) * 10) / 10,
  };
}
