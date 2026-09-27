import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import usePageTitle from "@/hooks/usePageTitle";

// Public /terms and /privacy pages, linked from sign-up, log-in, billing and the
// report page. Plain language on purpose; keep them in step with what the app does.
const UPDATED = "September 24, 2026";
// Optional: a support address to show instead of the contact form (/contact).
const CONTACT_EMAIL = "";

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <Link to="/contact">our contact form</Link>
  );
}

function LegalPage({ title, other, children }) {
  usePageTitle(title);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-10">
      <article className="max-w-2xl mx-auto text-sm leading-relaxed [&_h2]:text-white [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-indigo-300 [&_a]:underline">
        <Link to="/" className="!no-underline !text-slate-400 hover:!text-white inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Nebulux AI
        </Link>
        <h1 className="text-3xl font-bold text-white mt-6">{title}</h1>
        <p className="text-slate-400 mt-1 mb-6">Last updated {UPDATED}</p>
        {children}
        <p className="mt-10 pt-4 border-t border-slate-800 text-slate-400">
          See also: <Link to={other.to}>{other.label}</Link>
        </p>
      </article>
    </div>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service" other={{ to: "/privacy", label: "Privacy Policy" }}>
      <p>
        These terms cover your use of Nebulux AI at nebuluxai.com, including its AI chat, Nebulux Code,
        the Website and Game Designers and the sites and games people publish with it. By
        creating an account or using Nebulux AI you agree to them. If you don't agree, please don't use it.
      </p>

      <h2>Who can use it</h2>
      <ul>
        <li>You must be at least 13 years old. If you're under 18, you need a parent or guardian's permission, especially before buying anything.</li>
        <li>Keep your login to yourself. You're responsible for what happens on your account.</li>
        <li>One account per person. Creating extra accounts to collect free credits, free trials, discounts or referral rewards isn't allowed.</li>
      </ul>

      <h2>Plans and credits</h2>
      <ul>
        <li>Using the AIs costs credits. Your plan gives you a monthly allowance, and you can also get credits from referrals, promo codes or the Nebulux AI team.</li>
        <li>Credits have no cash value, can't be sold or transferred, and may expire as described in the app.</li>
        <li>Paid plans are charged through our payment providers at the price shown before you pay. They save your card and charge it each month while your plan renews; we never see or store your card number. Passwords are handled by our sign-in provider, never by us.</li>
        <li>Instead of a plan you can buy a one-time pack of credits for one AI. Bought credits are used before your monthly allowance and don't reset at the end of the month. The new-member discount doesn't apply to credit packs.</li>
        <li>Some promo codes give a discount instead of credits. Each person can use a discount code once, it only works on what it says it's for, and it may have an end date or a limited number of uses. It doesn't combine with the new-member discount: the bigger of the two is used.</li>
        <li>Credits or rewards gained by cheating — fake sign-ups, abusing referrals, exploiting bugs — can be removed, and the account can be suspended.</li>
      </ul>

      <h2>New-member offer</h2>
      <ul>
        <li>Accounts created on or after September 24, 2026 get the Pro plan free for 7 days. When the week ends the account goes back to the Free plan unless you choose a paid plan. We don't ask for payment details to start the free week.</li>
        <li>From sign-up until 48 hours after the free week, one purchase gets a discount: 30% off a plan (that lower price continues for as long as that subscription stays active) or 20% off a one-time credit pack. It can be used once: after a plan or credit pack is bought at the lower price, later purchases are at the normal price, even within the 48 hours.</li>
        <li>We may change or end this offer for new accounts at any time.</li>
      </ul>

      <h2>Enterprise</h2>
      <ul>
        <li>The Enterprise plan is only for legally registered organizations. You apply with your organization's details, we check them, and we may decline an application.</li>
        <li>Enterprise is priced per seat. We send a quote before anything is charged, and turn the plan on once it's paid.</li>
        <li>The organization's credits are shared by everyone on it. The person who applied manages who is on it and is responsible for how those people use Nebulux AI.</li>
      </ul>

      <h2>AI answers</h2>
      <p>
        Answers, code, sites and games made by the AI can be wrong, incomplete or unsafe. Check anything important
        before relying on it, and don't use the AI for medical, legal, financial or safety decisions. You're
        responsible for how you use what it produces.
      </p>

      <h2>What you publish</h2>
      <ul>
        <li>You keep ownership of what you create. By publishing a site or game you let us host, show and copy it as needed to run Nebulux AI.</li>
        <li>Published sites and games are public: anyone with the address can see them.</li>
        <li>If you sell things on your site, you are the seller and are responsible for delivering what you sell, for refunds to your buyers and for following the law. Nebulux AI keeps a platform fee from each sale, as shown when you set up selling.</li>
        <li>Payouts for your sales are sent after a waiting period, so that card disputes can come in first, and a payout can be held while we check a sale that looks like fraud (for example, buying from your own site). A sale that turns out to be fraudulent or is charged back isn't paid out.</li>
      </ul>

      <h2>Not allowed</h2>
      <p>You may not use Nebulux AI, or publish anything with it, that:</p>
      <ul>
        <li>tricks people into giving passwords, card numbers or other private information (phishing);</li>
        <li>scams people, sells things that don't exist, or pretends to be another person, company or brand;</li>
        <li>spreads malware or harmful downloads, or attacks other systems;</li>
        <li>is illegal, sexual content involving minors, hate, harassment, threats, or graphic violence;</li>
        <li>copies other people's work in a way that breaks their copyright or trademark;</li>
        <li>tries to get around credit limits, bans or other safety measures, or overloads the service.</li>
      </ul>

      <h2>Reports and removal</h2>
      <p>
        Anyone can report a published site or game with the Report link on it. We can take down content, remove
        credits, or suspend or delete accounts that break these terms, with or without warning. Content that was
        taken down can't be published again under the same name. If you think we made a mistake, tell us through
        the contact page and we'll look at it again.
      </p>

      <h2>No warranty</h2>
      <p>
        Nebulux AI is provided "as is". We work to keep it running, but it may change, have errors or be
        unavailable, and features, plans and prices can change. To the fullest extent the law allows, we are not
        liable for any damages or losses of any kind that come from using (or not being able to use) Nebulux AI.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using Nebulux AI and delete your account at any time from your profile. We may update these
        terms; if the changes are important we'll tell you in the app, and continuing to use it means you accept them.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms? Contact us through <Contact />.</p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" other={{ to: "/terms", label: "Terms of Service" }}>
      <p>This explains what Nebulux AI collects, why, and who helps us run it.</p>
      <div className="my-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <p className="font-semibold text-white">In short</p>
        <ul>
          <li>We don't sell your information, and we don't show ads or use tracking cookies.</li>
          <li>Your chats and website projects are saved in your own browser, not on our servers.</li>
          <li>What you ask the AI goes to Google to get an answer; we keep only the start of your five latest questions, to keep the service safe.</li>
          <li>You can download a copy of your data or delete your account at any time.</li>
          <li>We never store your password or card. Your password is kept scrambled by our sign-in provider, and your card is kept by our payment providers, who also charge it for renewals.</li>
        </ul>
      </div>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address, and your name and picture if you sign in with Google.</li>
        <li><strong>Forms on sites people make:</strong> if you fill in a form on a site made with Nebulux AI (a booking, an RSVP, a sign-up), what you type is kept for that site's owner to read, up to their latest 200 messages. Password and card-number fields are never sent, and the owner can delete messages at any time.</li>
        <li><strong>What you make:</strong> the sites and games you publish, and your game draft. Your chats and website projects are saved in your own browser, not on our servers.</li>
        <li><strong>Prompts:</strong> what you send the AI, including any images you attach in the chat, passes through our servers to Google to get an answer. We count the credits it uses, and keep the start (up to 300 characters) of your five most recent questions each month so our team can spot misuse and help if something goes wrong. We don't keep the rest of the text, or any images.</li>
        <li><strong>Usage:</strong> how many credits you use on each AI, your plan, promo codes you redeem, and who invited you or whom you invited. When you join through an invite link we keep a scrambled (hashed) form of your IP address with it, to spot one person creating many accounts.</li>
        <li><strong>Payments:</strong> what you bought, when, and whether it renewed. Your card is entered on our payment provider's checkout page and saved by them, not by us; if your plan renews every month, they charge the saved card and only tell us that it was paid. We never see or store your card number.</li>
        <li><strong>Passwords:</strong> we never see or store your password. Sign-in is handled by our sign-in provider, which keeps passwords scrambled (hashed) so they can't be read, not even by us. For two-step verification we keep the secret key for your authenticator app and the devices you chose to remember, never a password.</li>
        <li><strong>Messages:</strong> what you send through the contact form, with your email address so we can reply. If you report an AI reply, that reply and the question you asked just before it are sent to us too.</li>
        <li><strong>Voice:</strong> if you use the microphone button, your browser turns what you say into text (Chrome and Edge do this on Google's or Microsoft's servers). We only receive the text you then send.</li>
        <li><strong>Enterprise applications:</strong> your organization's legal name, type, where it's registered, registration number or EIN, website, and your name, role, work email and phone. Only the Nebulux AI team sees them, to check the organization is real and send a quote.</li>
        <li><strong>Admin actions:</strong> when the Nebulux AI team changes an account's plan, credits, access or a promo code, or takes a page down, we record what changed, on which account, which team member did it and roughly where they were (city and country), to catch mistakes and misuse.</li>
        <li><strong>Sign-in safety:</strong> to stop people guessing passwords or sign-up codes, we briefly count sign-in tries for each email address and network. The counts are kept for at most an hour and aren't used for anything else.</li>
        <li><strong>Reports:</strong> when you report a site we keep your reason and note, plus a scrambled (hashed) form of your IP address so the same person can't report one page many times.</li>
        <li><strong>Usage analytics:</strong> basic information about how the app is used, such as which pages are opened, how long a visit lasts and which website sent you here. It's collected by Base44, which runs the app's sign-in and database, and helps us see what's working. We don't use it for ads.</li>
        <li><strong>Technical data:</strong> like any website, our hosting provider handles IP addresses and basic request logs to deliver pages and block attacks.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and the features you use, and to count and enforce credits.</li>
        <li>To keep Nebulux AI safe: stopping abuse, reviewing reported content and preventing fraud.</li>
        <li>To handle payments and pay site owners for their sales.</li>
        <li>To give new accounts their free week and one-time discount, and to check Enterprise applications.</li>
      </ul>
      <p>We don't sell your personal information and we don't show you ads.</p>

      <h2>Who helps us run it</h2>
      <ul>
        <li><strong>Base44</strong> — sign-in, the app database and payments.</li>
        <li><strong>Wix</strong> — runs the checkout for Base44 Payments and handles your card. We never see or store your card number.</li>
        <li><strong>GitHub</strong> — only if you connect your GitHub account to save a site's code there.</li>
        <li><strong>Cloudflare</strong> — hosting, published pages, credits and drafts storage.</li>
        <li>
          <strong>Google (Gemini API)</strong> — writes the AI answers, so your prompts and chat context are sent to
          Google. On the plan we use, Google may keep them and use them to improve its products, and people at
          Google may review them.{" "}
          <strong>Don't put passwords, health information or other secrets into the AI.</strong>
        </li>
      </ul>

      <h2>What's public</h2>
      <p>
        Sites and games you publish are public, and so is anything you add to the gallery. Your chats and unpublished
        drafts are not shared with other users.
      </p>

      <h2>Stored on your device</h2>
      <p>
        We use your browser's storage for sign-in, settings such as your theme, and your chats, website projects and
        attached images. When you sign out, your chats are put aside on that device and come back when you sign in
        there again; Settings → Security can remove them completely. We don't use advertising or tracking cookies.
      </p>

      <h2>Keeping and deleting</h2>
      <p>
        We keep your data while your account is open. You can download a copy of it at any time (Settings → Security →
        Download my data). You can delete your account at any time from your profile;
        that also deletes your published sites and games, your game draft, and the chats and projects saved in that
        browser. We keep records we need for payments, fraud prevention (such as who invited whom) or the law, and a
        copy of any page we took down for breaking the rules.
      </p>

      <h2>Children</h2>
      <p>Nebulux AI isn't for children under 13, and we don't knowingly collect their information.</p>

      <h2>Changes and contact</h2>
      <p>
        If we change this policy we'll update the date above, and tell you in the app for important changes.
        Questions or requests about your data: contact us through <Contact />.
      </p>
    </LegalPage>
  );
}
