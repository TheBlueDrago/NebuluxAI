// The examples gallery (pages/Showcase.jsx): the best games, and what people use Nebulux Orbit for.
// Websites in the gallery come from people who opted in (the "showcase" function).
export const ORBIT_URL = "https://nebuluxorbit.thebluedragonstriker.workers.dev/";
export const SITES_URL = "https://nebuluxsites.thebluedragonstriker.workers.dev/";

export const BEST_GAMES = [
  { name: "block-dash-race", title: "Block Dash Race", text: "Twelve runners, one wild obstacle course." },
  { name: "titan-raid", title: "Titan Raid", text: "Team up with three heroes against a giant stone boss." },
  { name: "block-kart-racers", title: "Block Kart Racers", text: "Drift, grab items and race seven karts over three laps." },
  { name: "fruit-seas", title: "Fruit Seas", text: "Sail between islands, eat fruits with powers and beat the bosses." },
  { name: "sky-obby", title: "Sky Obby", text: "50 hard stages in the sky and a glass bridge at the end." },
  { name: "storm-royale", title: "Storm Royale", text: "Drop in, loot, and be the last one standing." },
];

// Each opens Orbit with the words already typed, so the visitor only has to press Send.
export const ORBIT_USES = [
  { title: "Plan my week", text: "Turn a messy list into a day-by-day plan.", ask: "Plan my week: I have school, soccer on Tuesday and Thursday, and a science project due Friday." },
  { title: "Reach a goal", text: "Type a goal and get the steps, as tasks you can tick off.", ask: "Help me reach this goal: run 5 km without stopping in 8 weeks." },
  { title: "Morning briefing", text: "Today's schedule, your goals and your reminders in one view.", ask: "Give me my briefing for today." },
  { title: "Remember things for me", text: "Tell it once. It remembers, and you can see or delete what it knows.", ask: "Remember that my dentist appointment is on the 3rd at 4 pm, and remind me the day before." },
  { title: "Draft an email", text: "It writes the email and only sends it after you approve.", ask: "Draft a polite email asking my teacher for two more days on my essay." },
  { title: "Study helper", text: "Make a study plan and quiz yourself before a test.", ask: "I have a history test on Friday about World War 2. Make me a study plan and quiz me." },
];
export const orbitLink = (ask) => ORBIT_URL + "?go=chat&new=1&text=" + encodeURIComponent(ask);

// The Arcade's featured game: one of the games with a picture, the same one for everybody all day (UTC).
export function featuredGame(names, now = Date.now()) {
  const pool = [...new Set(names)].sort();
  return pool.length ? pool[Math.floor(now / 86400000) % pool.length] : "";
}
