import { createContext, useContext } from "react";

// How Monitor's cards know to reload. Each number goes up when it's time; a card puts the one it
// wants in its useEffect list, so it reloads without losing anything open or typed in it.
//   live    every 30 seconds while the page is showing, for cards that only read the database
//   slow    every 5 minutes, for cards that read or list KV (free KV allows 1,000 lists a day)
//   manual  only when the Refresh button is pressed, for the heaviest card
export const MonitorTick = createContext({ live: 0, slow: 0, manual: 0 });
export const useMonitorTick = () => useContext(MonitorTick);
