import { readFileSync, writeFileSync } from 'node:fs';
const m = JSON.parse(readFileSync('./video/marks.json', 'utf8'));
const at = (n) => m.find((x) => x.what === n)?.at ?? 0;
const T = {
  home: at('home'), cat: at('categories'), rails: at('rails'), list: at('list-surplus'),
  submit: at('submit-listing'), buyer: at('buyer'), find: at('find-matches'),
  checks: at('checks'), near: at('near-misses'), reserve: at('reserve'),
  confirm: at('confirm'), handoff: at('handoff'), impact: at('impact'), end: at('end'),
};
const cues = [
  [0,          T.cat,        "A Mumbai furniture workshop produces 80 kg\nof clean plywood offcuts every week."],
  [T.cat,      T.rails,      "Two kilometres away, a decor business\nbuys new wood for the same job."],
  [T.rails,    T.list,       "Neither knows the other exists. The material\nhas value — what's missing is coordination."],
  [T.list,     T.list + 7,   "DeadStock Exchange turns one business's\nsurplus into another's raw material."],
  [T.list + 7, T.submit,     "The workshop lists it in under a minute:\nquantity, condition, and the dimensions."],
  [T.submit,   T.buyer,      "80 kg of clean, untreated offcuts,\n15 to 40 cm, available for three days."],
  [T.buyer,    T.buyer + 7,  "Now the other side. The decor business\nsays what it needs."],
  [T.buyer + 7,T.find,       "50 kg, nothing under 10 cm, untreated,\nwithin 15 kilometres."],
  [T.find,     T.checks,     "One request. One round trip."],
  [T.checks,   T.checks + 6, "One compatible match —\nand it shows exactly why."],
  [T.checks+6, T.checks + 12,"Category, quantity, minimum size, condition,\navailability window, distance."],
  [T.checks+12,T.near,       "Six checks, in plain words.\nNo relevance score, no black box."],
  [T.near,     T.near + 8,   "Two nearby listings didn't match — and it\nsays which check each one failed."],
  [T.near + 8, T.reserve,    "That explanation is the product."],
  [T.reserve,  T.reserve + 7,"Reserve 50 of the 80. Partial reservation\nis the normal case, not an edge case."],
  [T.reserve+7,T.confirm,    "The supplier keeps 30."],
  [T.confirm,  T.handoff,    "A conditional write in DynamoDB makes\nover-reservation impossible."],
  [T.handoff,  T.handoff + 8,"The supplier confirms the material\nphysically changed hands."],
  [T.handoff+8,T.impact,     "Only then is it recorded as reuse."],
  [T.impact,   T.impact + 7, "50 kg redirected through a single match."],
  [T.impact+7, T.end,        "Every figure traces back to a completed\nhandoff. Measured, not estimated."],
];
const ts = (s) => `00:${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')},${String(Math.round((s%1)*1000)).padStart(3,'0')}`;
let out = '', i = 1, longest = 0;
for (const [a, b, text] of cues) {
  if (b <= a) continue;
  for (const l of text.split('\n')) longest = Math.max(longest, l.length);
  out += `${i++}\n${ts(a)} --> ${ts(b)}\n${text}\n\n`;
}
writeFileSync('./video/subs.srt', out);
console.log(`  cues ${i-1}  longest line ${longest}  ends ${ts(cues.at(-1)[1])}`);
