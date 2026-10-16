import { showNotice } from "@/lib/dialogs";

// The "?" key in the chat and in Nebulux Code: the list of keyboard shortcuts.
export function showShortcuts() {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "Cmd" : "Ctrl";
  showNotice(
    ["Keyboard shortcuts", "", "/   Jump to the message box", "Enter   Send", "Shift+Enter   New line", "Esc   Stop the answer", `${mod}+Shift+O   New chat`, "?   Show this list"].join("\n"),
    { confirmLabel: "Got it" }
  );
}
