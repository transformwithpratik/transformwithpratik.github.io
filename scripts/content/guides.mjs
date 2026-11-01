// Library guides. Each becomes /library/<slug>/index.html via scripts/build-guides.mjs.
// Keep claims to what the cited sources say; name the population when a finding is narrow.

export const GUIDES = [
  {
    slug: 'nutrition-fundamentals',
    title: 'Nutrition fundamentals',
    category: 'Nutrition',
    description: 'Calories, protein, fibre and how to build a plate that fits your goal, without banning foods.',
    body: `
<p class="lead">You do not need a perfect diet. You need a few numbers that point in the right direction and meals you can repeat on a busy day. Here is the short version of what matters, in order.</p>

<h2>1. Calories decide the direction</h2>
<p>Your weight trend follows your average energy balance over weeks, not any single meal. Eat a little less than you burn and you lose weight; a little more and you gain. The <a href="/calculator">calculator</a> gives you a starting target.</p>
<ul>
  <li>For fat loss, a moderate deficit (10 to 20 percent below maintenance) is easier to keep up and helps protect muscle.</li>
  <li>Losing about 0.5 to 1 percent of your body weight per week is a pace most people can sustain while keeping strength.</li>
  <li>For muscle gain, a small surplus (around 10 percent) is enough. More mostly adds fat.</li>
</ul>

<h2>2. Protein protects and builds muscle</h2>
<p>If you strength train, research supports about 1.6 g of protein per kg of body weight per day, with benefits possibly continuing up to about 2.2 g per kg. Spreading it over 3 or 4 meals of roughly 25 to 40 g each is a practical way to get there.</p>
<table>
  <thead><tr><th>Vegetarian food</th><th>Typical portion</th><th>Protein</th></tr></thead>
  <tbody>
    <tr><td>Paneer</td><td>100 g</td><td>about 18 g</td></tr>
    <tr><td>Firm tofu</td><td>100 g</td><td>about 17 g</td></tr>
    <tr><td>Hung curd or Greek yogurt</td><td>150 g</td><td>about 15 g</td></tr>
    <tr><td>Soya chunks</td><td>30 g dry</td><td>about 16 g</td></tr>
    <tr><td>Moong or masoor dal</td><td>1 katori (30 g dry)</td><td>about 7 g</td></tr>
    <tr><td>Boiled chana</td><td>1 cup (150 g)</td><td>about 13 g</td></tr>
    <tr><td>Toned milk</td><td>1 glass (250 ml)</td><td>about 8 g</td></tr>
    <tr><td>Whey protein</td><td>1 scoop (30 g)</td><td>about 23 g (check your label)</td></tr>
  </tbody>
</table>
<p>A normal Indian vegetarian day of dal, roti and sabzi often lands around 50 to 60 g. Adding one dense source to each meal (curd at breakfast, paneer or soya at lunch, a dal plus tofu dinner) usually closes the gap without supplements.</p>

<h2>3. Vegetables and fibre keep you full</h2>
<p>ICMR-NIN's dietary guidelines suggest vegetables and fruits make up about half of what you eat in a day. Higher fibre intakes, roughly 25 to 29 g a day from whole foods, are linked in large studies to lower rates of heart disease, type 2 diabetes and bowel cancer. Practically: a sabzi or salad with lunch and dinner, a fruit a day, whole dals and some whole grains.</p>

<h2>4. Carbs and fats are not the enemy</h2>
<p>Once calories and protein are right, you can split the rest between carbs and fats in the way you enjoy. Keep fat to at least about 20 percent of calories for hormones and absorbing vitamins. Watch cooking oil: one tablespoon is about 120 kcal, and it is easy to pour three.</p>

<h2>5. Go easy on added sugar and salt</h2>
<p>ICMR-NIN advises keeping added sugar under 5 percent of your calories, and that includes jaggery and honey, which are still sugars. The WHO recommends less than 5 g of salt a day; packaged snacks, pickles and restaurant food are where most of it hides.</p>

<h2>Build the plate</h2>
<ul>
  <li><b>Half</b>: vegetables or salad.</li>
  <li><b>A quarter</b>: a protein source such as dal, paneer, tofu, soya, curd or eggs.</li>
  <li><b>A quarter</b>: roti, rice or millets. Adjust this part up or down with your goal.</li>
  <li>Add a bowl of curd or a glass of chaas if it fits your day.</li>
</ul>

<h2>How to check it is working</h2>
<p>Weigh yourself a few mornings a week, after the toilet and before eating, and compare weekly averages rather than single days. If the average has not moved in the direction you want after 2 to 3 weeks, adjust by 100 to 200 kcal a day and give it another 2 weeks.</p>
`,
    sources: [
      'Morton RW, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.',
      'Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
      'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
      'ICMR-National Institute of Nutrition. Dietary Guidelines for Indians. Hyderabad; 2024.',
      'Reynolds A, et al. Carbohydrate quality and human health: a series of systematic reviews and meta-analyses. Lancet. 2019;393:434-445.',
      'World Health Organization. Salt reduction fact sheet (recommendation of less than 5 g of salt per day).',
    ],
  },
  {
    slug: 'office-snack-guide',
    title: 'Healthy office snack guide',
    category: 'Office',
    description: 'What to keep in your desk drawer and what to pick from the cafeteria when you are hungry at 4 pm.',
    body: `
<p class="lead">The 4 pm snack is where many good days go sideways: a biscuit packet, a samosa in a meeting, a sugary coffee. The fix is not willpower. It is having something better within arm's reach.</p>

<h2>What makes a good work snack</h2>
<ul>
  <li><b>Some protein</b> (10 g or more) so it actually holds you until dinner.</li>
  <li><b>Some fibre</b> from fruit, chana, sprouts or nuts.</li>
  <li><b>A sensible size</b>: 150 to 250 kcal for most people.</li>
</ul>

<h2>Desk drawer (no fridge needed)</h2>
<ul>
  <li>Roasted chana: a small bowl (30 g) gives about 6 g of protein.</li>
  <li>Makhana and peanuts, roasted at home. See the <a href="/nutrition/recipes/roasted-makhana-peanuts">recipe</a>.</li>
  <li>Peanuts or almonds, pre-portioned into small boxes so a handful stays a handful.</li>
  <li>Whey protein or sattu sachets to mix with water.</li>
  <li>Protein bars: read the label. Look for at least 15 g of protein and less sugar than protein.</li>
  <li>Fruit that travels: bananas, apples, oranges.</li>
</ul>

<h2>Office fridge</h2>
<ul>
  <li>Hung curd or Greek yogurt cups, with fruit.</li>
  <li><a href="/nutrition/recipes/chana-chaat">Chana chaat</a> or <a href="/nutrition/recipes/moong-sprouts-salad">sprouts salad</a> made the night before.</li>
  <li>Paneer cubes with chaat masala and lemon.</li>
  <li>Chaas or a glass of milk.</li>
</ul>

<h2>Ten quick options</h2>
<table>
  <thead><tr><th>Snack</th><th>Approx. kcal</th><th>Approx. protein</th></tr></thead>
  <tbody>
    <tr><td>Whey with water</td><td>120</td><td>23 g</td></tr>
    <tr><td>150 g hung curd with half an apple</td><td>150</td><td>15 g</td></tr>
    <tr><td>Chana chaat</td><td>275</td><td>14 g</td></tr>
    <tr><td>Sprouts salad with peanuts</td><td>245</td><td>14 g</td></tr>
    <tr><td>Namkeen sattu drink</td><td>160</td><td>9 g</td></tr>
    <tr><td>Makhana and peanuts</td><td>220</td><td>9 g</td></tr>
    <tr><td>A glass of toned milk</td><td>145</td><td>8 g</td></tr>
    <tr><td>Roasted chana, 30 g</td><td>110</td><td>6 g</td></tr>
    <tr><td>10 almonds</td><td>80</td><td>3 g</td></tr>
    <tr><td>A banana</td><td>90</td><td>1 g</td></tr>
  </tbody>
</table>

<h2>In the cafeteria</h2>
<ul>
  <li>Pick a dal and a sabzi first, then add one roti or a small portion of rice.</li>
  <li>Idli or dosa with sambar beats vada or puri; the sambar adds some protein.</li>
  <li>Grilled or tandoori over fried and creamy gravies.</li>
  <li>Eggetarian? An omelette or boiled eggs are among the easiest protein options at most counters.</li>
</ul>

<h2>Meetings and celebrations</h2>
<p>Cake and samosas will appear. Have a piece if you want it, sit down, and enjoy it. One snack does not decide your week. What matters is that it is the exception, not the default.</p>

<h2>Watch the drinks</h2>
<p>Two sugary teas or coffees a day can add 150 to 250 kcal without you noticing. Try cutting the sugar by half for a week, then half again. And keep a water bottle on your desk; it is the simplest hydration habit there is.</p>
`,
    sources: [
      'Protein and calorie values estimated from USDA FoodData Central, IFCT 2017 and typical pack labels. See the recipe pages for full breakdowns.',
    ],
  },
  {
    slug: 'weekly-grocery-list',
    title: 'Weekly grocery list',
    category: 'Nutrition',
    description: 'A printable vegetarian high-protein shopping list, grouped by aisle.',
    checklist: true,
    body: `
<p class="lead">A vegetarian high-protein kitchen for one person for a week. Tick what you already have; your ticks are saved on this device. Use <b>Save as PDF</b> to take it to the shop.</p>

<h2>Protein</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Paneer, 400 to 500 g</label></li>
  <li><label class="check"><input type="checkbox"> Firm tofu, 400 g</label></li>
  <li><label class="check"><input type="checkbox"> Curd, 1 kg (hang some for hung curd)</label></li>
  <li><label class="check"><input type="checkbox"> Milk, 2 litres</label></li>
  <li><label class="check"><input type="checkbox"> Soya chunks, 200 g pack</label></li>
  <li><label class="check"><input type="checkbox"> Eggs, if you eat them</label></li>
  <li><label class="check"><input type="checkbox"> Whey or plant protein, optional</label></li>
</ul>

<h2>Dals and pulses</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Moong dal, 500 g</label></li>
  <li><label class="check"><input type="checkbox"> Masoor dal, 500 g</label></li>
  <li><label class="check"><input type="checkbox"> Kabuli chana, 500 g</label></li>
  <li><label class="check"><input type="checkbox"> Rajma, 500 g</label></li>
  <li><label class="check"><input type="checkbox"> Whole moong for sprouts, 250 g</label></li>
  <li><label class="check"><input type="checkbox"> Besan and sattu</label></li>
</ul>

<h2>Grains</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Whole wheat atta</label></li>
  <li><label class="check"><input type="checkbox"> Rice or millets</label></li>
  <li><label class="check"><input type="checkbox"> Rolled oats</label></li>
  <li><label class="check"><input type="checkbox"> Poha</label></li>
  <li><label class="check"><input type="checkbox"> Whole wheat bread, optional</label></li>
</ul>

<h2>Vegetables</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Spinach or other greens, 2 bunches</label></li>
  <li><label class="check"><input type="checkbox"> Onions, tomatoes, cucumbers</label></li>
  <li><label class="check"><input type="checkbox"> Capsicum, carrots, beans, cabbage</label></li>
  <li><label class="check"><input type="checkbox"> Cauliflower, broccoli or mushrooms</label></li>
  <li><label class="check"><input type="checkbox"> Frozen peas or sweet corn</label></li>
</ul>

<h2>Fruit</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Bananas and apples</label></li>
  <li><label class="check"><input type="checkbox"> Seasonal fruit</label></li>
  <li><label class="check"><input type="checkbox"> Lemons</label></li>
  <li><label class="check"><input type="checkbox"> Pomegranate, optional</label></li>
</ul>

<h2>Nuts, seeds and snacks</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Peanuts and almonds</label></li>
  <li><label class="check"><input type="checkbox"> Chia, flax or pumpkin seeds</label></li>
  <li><label class="check"><input type="checkbox"> Makhana and roasted chana</label></li>
</ul>

<h2>Flavour and cooking</h2>
<ul class="checklist" data-checklist>
  <li><label class="check"><input type="checkbox"> Ginger, garlic, green chillies</label></li>
  <li><label class="check"><input type="checkbox"> Coriander and mint</label></li>
  <li><label class="check"><input type="checkbox"> Jeera, turmeric, chilli, garam masala, chaat masala</label></li>
  <li><label class="check"><input type="checkbox"> Cooking oil and a little ghee</label></li>
</ul>

<h2>Sunday prep, 45 minutes</h2>
<ol>
  <li>Soak and pressure cook a big batch of chana or rajma. It keeps 4 days in the fridge.</li>
  <li>Tie 500 g curd in a muslin cloth to hang overnight.</li>
  <li>Soak whole moong to sprout by Tuesday.</li>
  <li>Wash and chop salad vegetables into a box.</li>
  <li>Portion nuts into small boxes for the week.</li>
</ol>
`,
    sources: [],
  },
  {
    slug: 'eating-out-guide',
    title: 'Eating-out guide',
    category: 'Nutrition',
    description: 'How to order at North Indian, South Indian, Indo-Chinese and cafe menus and stay on track.',
    body: `
<p class="lead">Team lunches, client dinners and weekend plans are part of life. You do not have to skip them or order a sad salad. A few defaults go a long way.</p>

<h2>Three rules that work anywhere</h2>
<ol>
  <li><b>Decide before you arrive.</b> Look at the menu online and pick your order while you are not hungry.</li>
  <li><b>Protein first.</b> Build the meal around a protein dish, then add one carb.</li>
  <li><b>Ask for it lighter.</b> "Less butter", "less oil" and "gravy on the side" are normal requests in most Indian restaurants.</li>
</ol>

<h2>North Indian</h2>
<ul>
  <li>Good picks: paneer or soya tikka, tandoori mushrooms, dal tadka, chana masala, mixed vegetables, raita, salad.</li>
  <li>Breads: tandoori roti over butter naan or kulcha.</li>
  <li>Go easy on: dal makhani, malai kofta, paneer butter masala and other cream-heavy gravies. Share one rather than having your own.</li>
</ul>

<h2>South Indian</h2>
<ul>
  <li>Good picks: idli with sambar, pesarattu (moong dal dosa), plain or onion uttapam, a bowl of curd.</li>
  <li>Ask for an extra bowl of sambar; it is one of the easier ways to add protein here.</li>
  <li>Go easy on: vada, ghee roast dosa and coconut chutney refills.</li>
</ul>

<h2>Indo-Chinese</h2>
<ul>
  <li>Good picks: clear or hot-and-sour soup, chilli paneer or tofu dry, steamed momos, stir-fried vegetables.</li>
  <li>Go easy on: deep-fried starters, gravy versions with thick sauces, fried rice and noodles as a whole plate.</li>
</ul>

<h2>Cafes</h2>
<ul>
  <li>Good picks: paneer or egg sandwiches on whole wheat, omelettes, Greek yogurt bowls, salads with paneer or chickpeas.</li>
  <li>Coffee: a regular latte is fine. Flavoured, whipped and frappe drinks can carry as much sugar as dessert.</li>
</ul>

<h2>Drinks and dessert</h2>
<ul>
  <li>Alcohol adds calories and tends to loosen food choices. If you drink, alternate with water and decide your limit in advance.</li>
  <li>Sweetened lassi, mocktails and cold drinks add up fast. Chaas, lime soda without sugar or water are easy swaps.</li>
  <li>Want dessert? Share it. A few spoons usually satisfy the craving.</li>
</ul>

<h2>The next day</h2>
<p>No compensating with skipped meals or punishment workouts. Go back to your normal plan, drink water, get your steps in. One meal out does not change your weekly trend.</p>
`,
    sources: [],
  },
  {
    slug: 'supplements',
    title: 'Supplements: what is worth it',
    category: 'Supplements',
    description: 'Creatine, whey, vitamin D, B12, caffeine and the products to skip.',
    body: `
<p class="lead">Supplements are the last few percent. Food, training and sleep do the heavy lifting. That said, a handful have solid evidence and can make life easier. Here is how I rank them.</p>

<h2>Worth considering</h2>
<h3>Creatine monohydrate</h3>
<p>The most researched sports supplement. With strength training, 3 to 5 g a day improves strength and helps build muscle, and it is considered safe for healthy adults. Vegetarians tend to have lower creatine stores in muscle, so they may notice a bigger effect. No loading phase is needed; take it at any time of day. If you have kidney disease, ask your doctor first.</p>

<h3>Whey or plant protein</h3>
<p>Not magic, just convenient protein. A scoop typically adds around 20 to 25 g. Useful when you cannot reach your protein target with food, for example on travel days or with a light breakfast. It counts towards your daily total, it does not add to it.</p>

<h3>Caffeine</h3>
<p>Doses of about 3 to 6 mg per kg of body weight, taken 30 to 60 minutes before training, reliably improve performance. A strong coffee is often enough. Caffeine can cost you sleep even when you fall asleep fine, so keep it away from the evening (see <a href="/library/sleep-and-recovery">Sleep and recovery</a>).</p>

<h2>Test first, then decide</h2>
<h3>Vitamin D</h3>
<p>Low vitamin D is common in Indian studies. Your skin makes the most around midday rather than at sunrise, and smog and sunscreen reduce it. Get a blood test and follow your doctor's dose rather than guessing.</p>

<h3>Vitamin B12</h3>
<p>A 2026 review estimated that about half of healthy young vegetarian adults in Indian studies are low in B12, and plenty of non-vegetarians are too. A blood test is cheap. Supplement if you are low.</p>

<h3>Omega-3 (fish or algae oil)</h3>
<p>Reasonable if you never eat fish, but evidence for large health benefits in healthy people is mixed. Ask your doctor if you take blood thinners.</p>

<h2>Usually skip</h2>
<ul>
  <li><b>Fat burners and detox teas.</b> No good evidence for meaningful fat loss, and some contain stimulants or laxatives.</li>
  <li><b>Testosterone boosters.</b> Herbal blends without convincing human evidence.</li>
  <li><b>BCAAs.</b> Little point if you already eat enough protein.</li>
  <li><b>Apple cider vinegar for weight loss.</b> The best-known trial behind the claim was retracted in 2025.</li>
  <li><b>Trendy "glow" supplements</b> such as NAD+ and glutathione: heavily promoted, with little good evidence in healthy people.</li>
</ul>

<h2>Buying safely</h2>
<p>Pick products with an FSSAI licence number, a full ingredient list and, ideally, third-party testing (such as Informed Sport or Informed Choice). Avoid anything promising rapid fat loss or muscle gain. If you are pregnant, breastfeeding, on medication or have a health condition, speak to your doctor before starting any supplement.</p>
`,
    sources: [
      'Kreider RB, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr. 2017;14:18.',
      'Guest NS, et al. International Society of Sports Nutrition position stand: caffeine and exercise performance. J Int Soc Sports Nutr. 2021;18:1.',
      'Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
      'Harinarayan CV, Holick MF, et al. Vitamin D status and sun exposure in India. Dermatoendocrinol. 2013;5(1):130-141.',
      'Review of vitamin B12 deficiency in India. Frontiers in Nutrition, published 16 October 2026.',
      'BMJ Group. Retraction of a trial on apple cider vinegar and weight loss, 25 September 2025.',
    ],
  },
  {
    slug: 'sleep-and-recovery',
    title: 'Sleep and recovery',
    category: 'Sleep and recovery',
    description: 'How much sleep you need, the caffeine cut-off that matters and simple recovery habits.',
    body: `
<p class="lead">Sleep is where training turns into progress. Short or irregular sleep makes hunger harder to manage, workouts feel heavier, and motivation drops. None of the fixes below cost money.</p>

<h2>How much</h2>
<p>Sleep medicine groups recommend that adults get <b>7 or more hours</b> a night on a regular basis. If you are often sleepy during the day, you probably need more than you are getting.</p>

<h2>Five habits that help</h2>
<h3>1. Set a coffee cut-off</h3>
<p>Across 24 studies, caffeine cut total sleep by about 45 minutes on average, sometimes without people noticing. For a regular cup of coffee, stopping roughly 9 hours before bed avoided most of the effect. Sleep at 11? Make 2 pm your last coffee. A regular cup of black tea had a much smaller effect in the same analysis.</p>
<h3>2. Wake up at the same time, even on Sundays</h3>
<p>In a large study of about 60,000 UK adults with wrist trackers, people with the most regular sleep had a lower risk of dying over the following years than the most irregular. It is an association in mostly older adults, not proof, but a fixed alarm is a free experiment.</p>
<h3>3. Bright mornings, dim evenings</h3>
<p>Light sets your body clock. Get outside in daylight in the morning, and dim the lights after dinner.</p>
<h3>4. Phone out of bed</h3>
<p>A trial of night-mode screen filters found no difference to sleep. What matters more is time in bed spent scrolling. Charge the phone outside the bedroom if you can.</p>
<h3>5. Finish dinner 2 to 3 hours before bed</h3>
<p>Lying down soon after a big meal is linked to more acid reflux. The evidence here is limited, but it is an easy habit, especially during wedding and festival season.</p>

<h2>Recovery between workouts</h2>
<ul>
  <li><b>Rest days are part of the plan.</b> Walk on them; easy movement helps you feel less stiff.</li>
  <li><b>Hit your protein</b> and eat enough overall. Big deficits make recovery slower.</li>
  <li><b>Lighter weeks.</b> Every 6 to 8 weeks, or when life gets heavy, cut your training volume by about half for a week.</li>
  <li><b>Soreness is not the goal.</b> It fades as you adapt; progress is measured in reps and weight, not pain.</li>
</ul>

<h2>When to see a doctor</h2>
<p>Loud snoring, waking up gasping, or being very sleepy during the day despite enough time in bed can be signs of sleep apnoea, which is common and treatable. Mouth taping is not a fix. Speak to a doctor.</p>
`,
    sources: [
      'Watson NF, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. Sleep. 2015;38(6):843-844.',
      'Gardiner C, et al. The effect of caffeine on subsequent sleep: a systematic review and meta-analysis. Sleep Med Rev. 2023;69:101764.',
      'Windred DP, et al. Sleep regularity is a stronger predictor of mortality risk than sleep duration: a prospective cohort study. Sleep. 2024;47(1).',
      'Duraccio KM, et al. Does iPhone Night Shift mitigate negative effects of smartphone use on sleep outcomes in emerging adults? Sleep Health. 2021;7(4):478-484.',
      'Fujiwara Y, et al. Association between dinner-to-bed time and gastro-esophageal reflux disease. Am J Gastroenterol. 2005;100(12):2633-2636.',
    ],
  },
  {
    slug: 'fitness-for-busy-professionals',
    title: 'Fitness for busy professionals',
    category: 'Busy professionals',
    description: 'The minimum weekly training that works, and how to fit it around a demanding job.',
    body: `
<p class="lead">You do not need two hours a day. You need a small amount of the right training, done most weeks, for a long time. Here is the minimum that works and how to protect it from your calendar.</p>

<h2>The minimum effective week</h2>
<ul>
  <li><b>Strength training 2 or 3 times a week</b>, about 40 to 50 minutes. Full-body sessions built on a squat, a hinge, a push, a pull and a carry or core exercise.</li>
  <li><b>Daily movement.</b> The WHO recommends 150 to 300 minutes of moderate activity a week, plus muscle-strengthening on 2 or more days. Brisk walking counts, and any bout counts; there is no 10-minute minimum anymore.</li>
  <li><b>Progress slowly.</b> Add a rep or a little weight when every set feels solid. That is how strength builds.</li>
</ul>
<p>See the <a href="/workouts">exercise library</a> for two weekly templates.</p>

<h2>When there is no time at all: exercise snacks</h2>
<p>Short bursts of hard effort spread through the day, such as climbing stairs briskly for a minute, have been tested in trials. A 2026 meta-analysis of 11 randomised trials found that snacks of 5 minutes or less, done at least twice a day, improved fitness in inactive adults. They did not change body fat, blood pressure or cholesterol, so treat them as a fitness top-up on busy days, not a replacement for training.</p>

<h2>Making it stick</h2>
<ol>
  <li><b>Put sessions in your calendar</b> like meetings, at the time you are least likely to be interrupted. For most people that is early morning.</li>
  <li><b>Have a short version.</b> If a day blows up, do 20 minutes: two exercises, three sets each. Something beats nothing.</li>
  <li><b>Train where it is easy.</b> A gym on the way to work, or a few dumbbells at home, beats the perfect gym across town.</li>
  <li><b>Plan for travel and deadlines</b> in advance (see <a href="/library/travel-fitness">Travel fitness</a>).</li>
  <li><b>Track it.</b> Writing down sets and weights shows progress on weeks when the mirror does not.</li>
</ol>

<h2>What to expect</h2>
<p>Strength goes up in the first few weeks. Visible changes in the mirror usually take 8 to 12 weeks of consistent training and eating. Missing a session is normal; missing the habit is the problem, so get back on plan at the next scheduled session.</p>
`,
    sources: [
      'Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54:1451-1462.',
      'Rodríguez et al. Effect of exercise snacks on fitness and cardiometabolic health in inactive adults: systematic review and meta-analysis of 11 randomised trials. Br J Sports Med. 2026.',
    ],
  },
  {
    slug: 'office-fitness',
    title: 'Office fitness',
    category: 'Office',
    description: 'Movement breaks, post-meal walks and desk habits for long working days.',
    body: `
<p class="lead">Long hours at a desk are the default for most professionals. You cannot always change the job, but you can change what happens around it.</p>

<h2>Break up long sitting</h2>
<p>Trials on breaking up sitting have mostly used short walking breaks about every 30 minutes. Practically: stand up when a call starts, walk to fill your water bottle, take the stairs to another floor's washroom, or set a gentle reminder for every 30 to 45 minutes.</p>

<h2>Walk after meals</h2>
<p>An easy 10-minute walk started within a few minutes of finishing a meal reliably blunts the rise in blood sugar after that meal. It is one of the best-supported small habits there is, and it pairs well with a post-lunch slump.</p>

<h2>Desk-friendly moves</h2>
<ul>
  <li><a href="/workouts#standing-calf-raise">Calf raises</a> while you wait for the kettle or the lift.</li>
  <li><a href="/workouts#hip-flexor-stretch">Hip flexor stretch</a> once or twice a day to counter long sitting.</li>
  <li>Stairs instead of the lift for one or two floors.</li>
  <li>Walking one-on-ones and phone calls.</li>
</ul>

<h2>Standing desks</h2>
<p>A standing desk cuts sitting time, but standing still is not exercise and long periods of standing come with their own aches. Use it as a cue to move, not as the goal.</p>

<h2>Screens and eyes</h2>
<ul>
  <li>People blink much less while looking at screens, and more blinks are only partial. Every so often, do a few slow, full blinks.</li>
  <li>The 20-20-20 rule (every 20 minutes, look 20 feet away for 20 seconds) eased eye-strain symptoms in a small study, but only while people kept doing it.</li>
  <li>Eye experts suggest a monitor slightly below eye level.</li>
  <li>Blue-light glasses probably do not reduce eye strain, according to a Cochrane review. Save the money.</li>
</ul>

<h2>Food at work</h2>
<p>Pack a protein-forward lunch, keep a water bottle on the desk, and have a planned snack for the afternoon. The <a href="/library/office-snack-guide">office snack guide</a> has a list.</p>
`,
    sources: [
      'Loh R, et al. Effects of interrupting prolonged sitting with physical activity breaks on blood glucose, insulin and triacylglycerol measures: a systematic review and meta-analysis. Sports Med. 2020;50:295-330.',
      'Buffey AJ, et al. The acute effects of interrupting prolonged sitting time in adults with standing and light-intensity walking on biomarkers of cardiometabolic health: a systematic review and meta-analysis. Sports Med. 2022;52:1765-1787.',
      'Engeroff T, et al. (2023). Systematic review and meta-analysis on the timing of walking after meals and post-meal blood glucose.',
      'Wolffsohn JS, et al. TFOS Lifestyle: impact of the digital environment on the ocular surface. Ocul Surf. 2023;28:213-252.',
      'Talens-Estarelles C, et al. The effects of breaks on digital eye strain, dry eye and binocular vision. Cont Lens Anterior Eye. 2023.',
      'Singh S, et al. Blue-light filtering spectacle lenses for visual performance, sleep, and macular health in adults. Cochrane Database Syst Rev. 2023.',
    ],
  },
  {
    slug: 'travel-fitness',
    title: 'Travel fitness',
    category: 'Travel',
    description: 'A 20-minute hotel-room workout and how to eat well on work trips.',
    body: `
<p class="lead">Work trips and holidays do not have to undo your progress, and they do not have to be perfect either. The aim is to keep the habit alive: move most days, eat protein at most meals, and sleep.</p>

<h2>20-minute hotel-room workout</h2>
<p>No equipment. Do each exercise for 40 seconds, rest 20 seconds, and go round 3 or 4 times.</p>
<ol>
  <li><a href="/workouts#bodyweight-squat">Bodyweight squat</a>, or slow squats with a 3-second lowering</li>
  <li><a href="/workouts#push-up">Push-up</a>, hands on the bed or desk to make it easier</li>
  <li>Reverse lunges, alternating legs</li>
  <li><a href="/workouts#glute-bridge">Glute bridge</a>, single-leg if it is too easy</li>
  <li><a href="/workouts#plank">Plank</a></li>
</ol>
<p>Got a hotel gym? Do your normal plan with whatever is there, or a simple full-body session: one squat or lunge, one press, one row, one hinge, plus core.</p>

<h2>Walk the trip</h2>
<p>Exploring on foot is training. Walk to meetings when it is safe and sensible, take the long way back to the hotel, and use the stairs.</p>

<h2>Eating on the road</h2>
<ul>
  <li><b>Hotel breakfast:</b> eggs, idli or dosa with sambar, curd, fruit, and a coffee. Go easy on the pastries.</li>
  <li><b>Airports and trains:</b> carry roasted chana, nuts, protein bars and a whey or sattu sachet.</li>
  <li><b>Client dinners:</b> use the <a href="/library/eating-out-guide">eating-out guide</a>: protein first, one carb, drinks with water in between.</li>
  <li><b>Holidays:</b> enjoy the local food. Keep breakfast and one other meal fairly simple, and let the third be the experience.</li>
</ul>

<h2>Jet lag and sleep</h2>
<p>Get daylight in the morning at your destination, keep caffeine early in the day, and try to sleep at local bedtime from the first night.</p>

<h2>Coming back</h2>
<p>Expect the scale to be up a little from salt, carbs and travel. It is mostly water and settles within a few days of normal routine. Go straight back to your plan; no detox needed.</p>
`,
    sources: [],
  },
];
