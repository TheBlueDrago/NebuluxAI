import { useEffect } from "react";

// The browser tab (and what screen readers announce on arrival): "Sign in · Nebulux AI".
export default function usePageTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    document.title = `${title} · Nebulux AI`;
    return () => {
      document.title = "Nebulux AI";
    };
  }, [title]);
}

// Titles for the signed-in pages under /chat (and a few next to it).
const APP_TITLES = [
  [/^\/chat\/?$/, "Chat"],
  [/^\/chat\/code/, "Nebulux Code"],
  [/^\/chat\/designer/, "Website Designer"],
  [/^\/chat\/game-designer/, "Game Designer"],
  [/^\/chat\/games/, "Games"],
  [/^\/chat\/game\//, "Game"],
  [/^\/chat\/(shop|plans)/, "Plans"],
  [/^\/chat\/monitor/, "Monitor"],
  [/^\/chat\/promos/, "Promo codes"],
  [/^\/chat\/settings/, "Settings"],
];
export const appTitleFor = (pathname) => (APP_TITLES.find(([re]) => re.test(pathname)) || [])[1] || "";
