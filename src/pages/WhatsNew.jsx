import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, Zap, BookOpen, Globe, Gift } from "lucide-react";
import PublicLayout, { START_FREE } from "@/components/PublicLayout";

// What changed lately, newest first, in plain words. Add to the top when something people
// would notice goes live; keep safety changes in Trust & safety's list too.
const UPDATES = [
  {
    date: "September 2026",
    items: [
      { icon: ShieldCheck, text: "Safer everywhere: the app and every published site on nebuluxai.com only open over a secure connection, other websites can't take over your tab, and published pages can't load old plugins or redirect all their links somewhere else." },
      { icon: Gift, text: "Refer a friend and get more: if someone you referred upgrades, you get free credits for every AI (25 each for Pro, 50 each for Team, 5 each per seat for Enterprise)." },
      { icon: BookOpen, text: "Tap-to-answer quizzes: say Quiz me (or tap Quiz me on this) and answer multiple-choice questions right in the chat, with the reason for each answer and your score at the end." },
      { icon: Globe, text: "QR codes: after you publish, or from your list of websites, show a QR code so people nearby can scan it and open your site or game on their phone." },
      { icon: Sparkles, text: "One-tap improvements in the Website and Game Designers: Make it harder, Add sound effects, Add a high score, Make it look more modern, Add a contact form and more." },
      { icon: BookOpen, text: "New guides: Study mode, and making flashcards with AI." },
      { icon: Sparkles, text: "Snap a question: take a photo of homework straight from the chat's start screen." },
      { icon: BookOpen, text: "Flashcards: ask for flashcards on any topic (or tap Make flashcards under an answer) and flip through them right in the chat, shuffle them and mark the ones you know." },
      { icon: Sparkles, text: "Pin your favourite chats to the top of the chat list with the pin button." },
      { icon: BookOpen, text: "Study mode: switch it on in the chat and the AI becomes a tutor, guiding you one step at a time with hints instead of just giving the answer. Ask for the answer whenever you want it." },
      { icon: Sparkles, text: "Quick follow-ups under each answer: tap \"Explain it more simply\", \"Give me an example\", \"Quiz me on this\" and more, picked to fit the answer." },
      { icon: Zap, text: "Keyboard shortcuts on a computer: / jumps to the message box, Esc stops an answer, and Ctrl+Shift+O (Cmd+Shift+O on a Mac) starts a new chat." },
      { icon: Sparkles, text: "Paste a screenshot straight into the chat, or drag pictures onto it, and ask about them. You'll see a small preview of each picture before you send." },
      { icon: Sparkles, text: "The AI always knows today's date, so questions like \"how many days until…\" or \"how old is…\" come out right." },
      { icon: Sparkles, text: "Talk-back: ask with the microphone and the AI reads its answer out loud, like a voice assistant. Tap the mic again to interrupt it." },
      { icon: BookOpen, text: "Math homework looks like a textbook now: fractions, powers, square roots and equations in the AI's answers show as real formulas, and Read aloud says them in words." },
      { icon: Sparkles, text: "When the AI writes a web page or an SVG picture in the chat or Nebulux Code, press Preview to run it right there, at computer or phone size." },
      { icon: Globe, text: "Open a page from your own GitHub repository in the Website Designer (on a computer, on paid plans), ask the AI for changes, and push them back to the same file." },
      { icon: Zap, text: "When lots of people are using the AI at once, it quietly tries again for you instead of showing an error, and new chats are named instantly." },
      { icon: Sparkles, text: "About you: tell the AI about yourself once (your grade, your interests, how you like answers) and every reply fits you. It's kept only on your device." },
      { icon: Sparkles, text: "The AI now remembers what you said earlier in the chat, so follow-ups like \"make it shorter\", \"why?\" or \"next question\" just work, in the chat and in Nebulux Code." },
      { icon: BookOpen, text: "Not sure what to ask? \"Things to ask AI\" has 38 ideas for school, writing, coding, everyday life, fun and work; tap one to try it." },
      { icon: Sparkles, text: "New here? A short welcome tour shows you around the chat, the menu, the Website and Game Designers and your profile, or you can explore on your own." },
      { icon: Sparkles, text: "In the chat: edit your last message and send it again, and have any answer read aloud with a tap of the speaker button." },
      { icon: Globe, text: "Forms on the websites you make now work: bookings, RSVPs and sign-ups arrive in your Messages inbox in the Website Designer, with a dot when something new comes in and a download to a spreadsheet." },
      { icon: BookOpen, text: "New guides for using the AI: homework help, writing, learning to code, resumes and cover letters, and running a small business, plus a guide for every website template." },
      { icon: Sparkles, text: "The chat suggests what to try first: homework help, explain simply, help me write and quiz me." },
      { icon: Sparkles, text: "Try any website template full screen before you sign up, and four new ones: local business, event invite, school club and resume." },
      { icon: Sparkles, text: "Edit your website's code by hand in the Website Designer, and push it to your own GitHub or download it as a ZIP on paid plans." },
      { icon: Zap, text: "The app opens much faster, especially when added to your phone's home screen, with no flash of the wrong colours." },
      { icon: ShieldCheck, text: "Every new account confirms its email with a code, fake accounts are limited, and sign-in always stays on nebuluxai.com." },
      { icon: ShieldCheck, text: "Buttons that ask \"Are you sure?\" now work in every browser, including the ones built into other apps." },
      { icon: Sparkles, text: "Lower prices for credit packs, and a new-member discount on them too." },
    ],
  },
];

export default function WhatsNew() {
  return (
    <PublicLayout title="What's new">
      <section className="text-center pt-8 pb-10">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-indigo-300">
          <Sparkles className="w-4 h-4" /> What's new
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-bold text-white">Always getting better</h1>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto">
          New features and fixes, often straight from ideas people send us. Got one?{" "}
          <Link to="/contact?topic=idea" className="text-indigo-300 hover:text-indigo-200 underline">Tell us</Link>.
        </p>
      </section>
      <div className="max-w-2xl mx-auto space-y-10">
        {UPDATES.map((u) => (
          <section key={u.date}>
            <h2 className="text-xl font-bold text-white">{u.date}</h2>
            <ul className="mt-4 space-y-3">
              {u.items.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 rounded-2xl bg-slate-900/50 border border-slate-800 p-4">
                  <Icon className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-14 text-center">
        <Link to={START_FREE} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90">
          Try it free
        </Link>
      </div>
    </PublicLayout>
  );
}
