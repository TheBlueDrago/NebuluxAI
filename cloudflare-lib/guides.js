// How-to guides (/guides and /guides/<slug>). Plain data with no JSX so both the app
// (src/pages/Guide.jsx) and the Cloudflare function that serves each guide with its text
// already in the page for search engines (functions/guides/[slug].js) use the same words.
// Keep every claim true to the product: limits and prices here must match the app.
export const GUIDES_UPDATED = "2026-09-25";

export const GUIDES = [
  {
    slug: "resume-and-cover-letter-with-ai",
    title: "How to write a resume and cover letter with AI",
    description:
      "Use AI to turn your experience into a strong resume and a cover letter for each job, in your own words, then put it online for free.",
    minutes: 4,
    intro:
      "Job hunting means writing about yourself again and again. Nebulux AI can help you find the right words, fit each application to the job, and catch mistakes, while it still sounds like you.",
    sections: [
      {
        heading: "Turn what you did into results",
        paragraphs: ["Tell the AI what you did in each job or project, in plain words, and ask it to help you show the result. Numbers make a resume stand out."],
        list: ["\"I ran the school bake sale. Help me describe it for a resume.\"", "\"Make this bullet point stronger: helped customers at the store.\""],
      },
      {
        heading: "Fit it to each job",
        paragraphs: ["Paste the job listing and your resume, and ask which of your skills to put first for this job. Don't add anything that isn't true: only change what you highlight."],
      },
      {
        heading: "Write a cover letter that sounds like you",
        paragraphs: ["Ask for a short outline first: why this company, what you'd bring, one example. Then write it yourself and ask the AI to check the tone and spelling."],
        list: ["\"Is this cover letter too long? What would you cut?\"", "\"Does this sound confident without bragging?\""],
      },
      {
        heading: "Put it online",
        paragraphs: ["A resume website is a link you can add to every application. Start from the Resume template, fill it with your details, and publish it free at yourname.nebuluxai.com."],
      },
      {
        heading: "Keep private details private",
        list: ["Leave your home address and personal phone number off anything public.", "Never paste passwords or ID numbers into any AI chat."],
      },
    ],
    cta: { label: "Start free", to: "/register?returnTo=%2Fchat" },
    more: { label: "Preview the resume template", to: "/templates?preview=resume" },
    related: ["resume-website", "write-better-with-ai"],
  },
  {
    slug: "ai-for-small-business",
    title: "10 ways AI can help your small business",
    description:
      "Practical ways a small business can use AI every day: customer emails, product descriptions, social posts, planning, and a website, for free.",
    minutes: 5,
    intro:
      "You don't need a big team to get help with the busywork. Here are ten everyday jobs Nebulux AI can take off your plate, with example requests you can copy.",
    sections: [
      {
        heading: "Talking to customers",
        list: [
          "1. Reply to emails and messages: \"Write a friendly reply to this customer who got the wrong order.\"",
          "2. Answer common questions: \"Write clear answers to the 5 questions customers ask us most.\"",
          "3. Handle reviews: \"Help me reply politely to this 2-star review.\"",
        ],
      },
      {
        heading: "Selling and marketing",
        list: [
          "4. Product descriptions: \"Write a short description for these handmade candles.\"",
          "5. Social posts: \"Give me a week of Instagram captions for our bakery.\"",
          "6. Flyers and signs: \"Write the words for a flyer for our summer sale.\"",
        ],
      },
      {
        heading: "Running the business",
        list: [
          "7. Planning: \"Help me plan my week: here\x27s everything I need to do.\"",
          "8. Simple maths: \"If I raise my prices by 10%, how much more do I make on 200 orders?\"",
          "9. Explaining things: \"Explain what a profit margin is in simple words.\"",
        ],
      },
      {
        heading: "Getting online",
        list: ["10. A website: describe your business to the Website Designer, or start from the Local business template, and publish it free the same day."],
      },
      {
        heading: "A few good habits",
        list: ["Check facts, prices and anything legal before you send it.", "Don\x27t paste customers\x27 card numbers or passwords into any AI chat.", "Keep your own voice: ask it to \"sound like a friendly local shop\"."],
      },
    ],
    cta: { label: "Try it free", to: "/register?returnTo=%2Fchat" },
    more: { label: "Websites for your business", to: "/business" },
    related: ["small-business-website", "write-better-with-ai"],
  },
  {
    slug: "write-better-with-ai",
    title: "How to write better with AI (essays, emails, stories)",
    description:
      "Use AI as a writing coach: plan, draft, and polish essays, emails and stories in your own voice, and learn what makes writing good.",
    minutes: 4,
    intro:
      "A blank page is the hardest part of writing. Nebulux AI can help you get started, organise your ideas and polish what you wrote, while it still sounds like you. Here's how.",
    sections: [
      {
        heading: "Start with a plan",
        paragraphs: ["Tell the AI what you're writing, who it's for and how long it should be, and ask for an outline first. Change the outline until it fits, then write."],
        list: ["\"I need a 500-word essay on why sleep matters for teenagers. Give me an outline with three main points.\"", "\"Help me plan a short scary story. Ask me questions about the characters first.\""],
      },
      {
        heading: "Write it, then ask for feedback",
        paragraphs: ["Write your own draft, then paste it in and ask what's working and what isn't. You learn more from feedback on your writing than from reading the AI's."],
        list: ["\"What\x27s the weakest paragraph and why?\"", "\"Point out grammar mistakes but don\x27t rewrite it.\"", "\"Is my ending strong enough?\""],
      },
      {
        heading: "Polish emails and messages",
        paragraphs: ["For everyday writing, the AI is great at making things clearer and kinder: \"Make this email to my boss shorter and more polite\" or \"Help me say no to this invitation nicely\"."],
      },
      {
        heading: "Keep it yours",
        list: ["Ask it to keep your words and voice: \"Only fix what\x27s wrong.\"", "Check facts, names and dates yourself.", "For school, follow your teacher\x27s rules on AI."],
      },
    ],
    cta: { label: "Start writing free", to: "/register?returnTo=%2Fchat" },
    related: ["ai-homework-help", "learn-to-code-with-ai"],
  },
  {
    slug: "learn-to-code-with-ai",
    title: "How to learn to code with AI",
    description:
      "Learn programming with an AI tutor: get code explained line by line, fix errors, and build small projects that actually run, for free.",
    minutes: 4,
    intro:
      "Learning to code is easier with a tutor who never gets tired of questions. Nebulux Code explains code, finds bugs and helps you build real projects, one small step at a time.",
    sections: [
      {
        heading: "Pick a small first project",
        paragraphs: ["The fastest way to learn is to build something you care about, small enough to finish in an afternoon."],
        list: ["A tip calculator", "A to-do list web page", "A quiz game about your favourite show"],
      },
      {
        heading: "Ask it to explain, line by line",
        paragraphs: ["Paste any code and ask \"Explain this line by line like I\x27m new to coding.\" Then change one thing and ask what will happen before you run it."],
      },
      {
        heading: "Fix errors yourself, with hints",
        paragraphs: ["When something breaks, paste the error and ask for a hint, not the fix: \"What does this error mean, and where should I look?\" You'll learn to debug, the most useful skill in programming."],
      },
      {
        heading: "See it running right away",
        paragraphs: ["Want to see your code on screen? The Website Designer and Games Designer turn your ideas into pages and games you can open, and the Edit code tab lets you read and change the code by hand."],
      },
      {
        heading: "Stay safe",
        list: ["Never paste real passwords, API keys or tokens into any AI chat. Nebulux AI warns you if you try.", "Keep practising without AI too, so you can code on your own."],
      },
    ],
    cta: { label: "Try Nebulux Code free", to: "/register?returnTo=%2Fchat%2Fcode" },
    more: { label: "Make a game", to: "/guides/make-a-game-without-coding" },
    related: ["make-a-game-without-coding", "ai-homework-help"],
  },
  {
    slug: "make-flashcards-with-ai",
    title: "How to make flashcards with AI in seconds",
    description:
      "Ask Nebulux AI for flashcards on any topic and flip through them right in the chat: shuffle, mark what you know, and quiz yourself. Free to start.",
    minutes: 3,
    intro:
      "Making flashcards by hand takes longer than studying them. With Nebulux AI you ask for them in one sentence and study straight away, on your phone or computer.",
    sections: [
      {
        heading: "Ask for them",
        paragraphs: ["Say what the cards are about and, if you like, your grade or how many you want. The cards appear in the chat, ready to flip."],
        list: ["\"Make flashcards about the planets.\"", "\"Make 12 flashcards for Spanish food words.\"", "\"Flashcards on the causes of World War I for 8th grade.\""],
      },
      {
        heading: "Or turn any answer into cards",
        paragraphs: ["After the AI explains something, tap Make flashcards under its answer and you get cards on exactly what it just taught you."],
      },
      {
        heading: "Study them",
        list: ["Tap a card to flip between the question and the answer.", "Mark the ones you know, and see how many are left.", "Shuffle to test yourself in a new order.", "Tap Make 10 more flashcards or Quiz me on this when you're ready for more."],
      },
      {
        heading: "Check them",
        paragraphs: ["AI can make mistakes, so compare the cards with your notes or textbook, especially dates, numbers and names."],
      },
    ],
    cta: { label: "Make flashcards free", to: "/register?returnTo=%2Fchat" },
    more: { label: "Use AI for homework the right way", to: "/guides/ai-homework-help" },
    related: ["ai-study-mode", "ai-homework-help"],
  },
  {
    slug: "ai-study-mode",
    title: "Study mode: an AI tutor that helps you learn, not just copy",
    description:
      "Turn on Study mode in Nebulux AI and it tutors you step by step with hints and questions instead of handing over the answer. Free for students.",
    minutes: 3,
    intro:
      "The fastest way to get an answer isn't always the fastest way to learn it. Study mode makes Nebulux AI act like a patient tutor, so you understand the work and can do it on the test.",
    sections: [
      {
        heading: "Turn it on",
        paragraphs: ["In the chat, tap Study under the message box. It turns green when it's on, and it stays on for your next questions until you turn it off."],
      },
      {
        heading: "What changes",
        list: ["It explains the idea briefly, then guides you one step at a time.", "It asks you to try the next step and gives a hint if you're stuck.", "It checks your tries kindly and tells you what was right.", "It gives the full answer only if you ask for it or after a few tries."],
      },
      {
        heading: "Works with photos and voice",
        paragraphs: ["Tap Snap a question to take a photo of a worksheet, or tap the microphone and say your question. With the microphone, the AI reads its answer out loud too."],
      },
      {
        heading: "For parents and teachers",
        paragraphs: ["Study mode is built for learning: it encourages students to think through the work instead of copying it. Everything published on Nebulux AI is safety-checked, and every page has a Report button."],
      },
    ],
    cta: { label: "Try Study mode free", to: "/register?returnTo=%2Fchat" },
    more: { label: "For parents and teachers", to: "/safety#parents" },
    related: ["make-flashcards-with-ai", "ai-homework-help"],
  },
  {
    slug: "ai-homework-help",
    title: "How to use AI for homework (the right way)",
    description:
      "Use AI to understand your homework, not just copy answers: ask it to explain step by step, quiz you, and check your work. Free with Nebulux AI.",
    minutes: 4,
    intro:
      "AI can be the best study partner you've ever had, or a shortcut that leaves you stuck on the test. The difference is how you ask. Here's how to use Nebulux AI so you actually learn.",
    sections: [
      {
        heading: "Ask it to explain, not just answer",
        paragraphs: ["Instead of pasting the question and copying the reply, ask the AI to teach you. It's patient, and you can ask the same thing again as many times as you need."],
        list: ["\"Explain photosynthesis like I'm 10.\"", "\"Show me how to solve this step by step, and stop before the last step so I can try it.\"", "\"Why is this the answer? What's the rule behind it?\""],
      },
      {
        heading: "Send a picture of the problem",
        paragraphs: ["Take a photo of the worksheet or textbook page and send it in the chat (up to 3 pictures at once), then ask about it. Typing on a phone? Tap the microphone and just say your question."],
      },
      {
        heading: "Let it quiz you",
        paragraphs: ["Before a test, ask the AI to quiz you. It can make practice questions at your level, tell you what you got wrong, and explain why."],
        list: ["\"Give me 5 practice questions on fractions, one at a time.\"", "\"Quiz me on the causes of World War I and tell me what I missed.\""],
      },
      {
        heading: "Check your own work",
        paragraphs: ["Do the work yourself first, then ask the AI to check it and point out mistakes without rewriting the whole thing. You'll remember it far better."],
      },
      {
        heading: "Know the limits",
        list: [
          "AI can make mistakes, so double-check facts that matter, and follow your teacher's rules about using AI.",
          "Don't share private details like your address, phone number or passwords. Nebulux AI warns you if a message looks like it has them.",
          "Handing in AI's words as your own isn't learning. Use it to understand, then write it yourself.",
        ],
      },
    ],
    cta: { label: "Start studying free", to: "/register?returnTo=%2Fchat" },
    more: { label: "For parents and teachers", to: "/safety#parents" },
    related: ["make-a-website-on-your-phone", "make-a-website-with-ai"],
  },
  {
    slug: "make-a-website-with-ai",
    title: "How to make a website for free with AI",
    description:
      "Make a real website without coding: describe it, let the AI build it, change anything by chatting, and publish it free with your own link.",
    minutes: 4,
    intro:
      "You don't need to know how to code, pay for hosting or wrestle with a page builder to have a website. With Nebulux AI you describe the site you want in plain words, and the AI builds it in about a minute. Here's how, step by step.",
    sections: [
      {
        heading: "What you need",
        paragraphs: ["A phone or computer with a web browser, and a free Nebulux AI account. No coding, no hosting to set up and no credit card."],
      },
      {
        heading: "Step 1: Describe your site",
        paragraphs: [
          "Open the Website Designer and write a sentence or two about the site. The more specific you are, the closer the first version will be: say who it's for, which sections you want and the look you like.",
        ],
        list: [
          "\"A site for my dog-walking business in Austin, with prices, reviews and a way to book.\"",
          "\"A page for our school's robotics club with meeting times and last season's projects.\"",
          "\"A dark, modern portfolio for my photography, with a big photo grid.\"",
        ],
      },
      {
        heading: "Step 2: Or start from a template",
        paragraphs: [
          "If you'd rather start from something finished, pick one of the free templates: a local business, a restaurant menu, an event invite, a resume and more. You can try each one full screen before you choose, then change anything about it.",
        ],
      },
      {
        heading: "Step 3: Change anything by chatting",
        paragraphs: [
          "Tell the AI what to change, the same way you'd tell a person. You can ask for one change at a time or several at once, and every version is kept, so you can go back to an earlier one. If you know some HTML, the Edit code tab lets you change the page by hand too.",
        ],
        list: ["\"Make the header dark blue and the buttons orange.\"", "\"Add a section with three customer reviews.\"", "\"Make it look great on phones.\""],
      },
      {
        heading: "Step 4: Publish and share",
        paragraphs: [
          "Press Publish and choose a name. Your site goes live at yourname.nebuluxai.com, a link you can text, post or print on a flyer. Every page is checked for scams and harmful content before it goes live, so visitors can trust it.",
          "The Free plan keeps up to three websites online. Pro (coming soon, $15 a month) will also let you download your site's code as a ZIP or push it to GitHub.",
        ],
      },
      {
        heading: "Tips for a better site",
        list: [
          "Give each page one clear goal, like \"call us\" or \"see the menu\".",
          "Use your real words and details; the AI can polish them for you.",
          "Open it on your phone before you share it. Most visitors will.",
          "Ask the AI to \"check the page for mistakes\" before you publish.",
        ],
      },
    ],
    cta: { label: "Build your website free", to: "/register?returnTo=%2Fchat%2Fdesigner" },
    related: ["make-a-website-on-your-phone", "small-business-website"],
  },
  {
    slug: "make-a-game-without-coding",
    title: "How to make your own video game without coding",
    description:
      "Turn a game idea into something you can play and share: describe it to the AI, test it, tweak it by chatting and publish it with one link.",
    minutes: 4,
    intro:
      "Everyone has a game idea. With Nebulux AI's Games Designer you can turn yours into a real game that runs in any browser, on phones too, without writing code. Here's how to go from idea to a link your friends can play.",
    sections: [
      {
        heading: "Start with a simple idea",
        paragraphs: [
          "The best first games do one thing well. Think of a single action the player repeats and a reason to keep going: a better score, a faster level, one more try.",
        ],
        list: ["Jump over obstacles that speed up over time", "Catch falling things and dodge the bad ones", "Fly through gaps without touching the walls", "Find the way out of a maze before time runs out"],
      },
      {
        heading: "Describe it to the Games Designer",
        paragraphs: [
          "Open the Games Designer, pick a style and describe the game: what the player controls, how you score, how you lose and how it should look. For example: \"A neon space game where I steer a ship left and right to dodge asteroids. I get a point for every second I survive, and it gets faster.\"",
          "The AI builds a complete game with a start screen, scoring, rising difficulty and a game-over screen with a restart button.",
        ],
      },
      {
        heading: "Play it and fix what feels off",
        paragraphs: [
          "Play it right away in the preview. If something feels wrong, say so in plain words and the AI changes it.",
        ],
        list: ["\"It's too hard at the start. Make the first 20 seconds slower.\"", "\"Make jumping floatier.\"", "\"Save my high score.\"", "\"Add a power-up that makes me invincible for 5 seconds.\""],
      },
      {
        heading: "It works on phones",
        paragraphs: [
          "Games are made to work on phones and tablets as well as computers: on a touch screen the game shows on-screen buttons for every move, so nobody needs a keyboard.",
        ],
      },
      {
        heading: "Publish and share",
        paragraphs: [
          "Press Publish and your game gets its own link, like nebuluxai.com/play/yourgame. Anyone can play it straight in their browser with no download and no account. The free plan publishes one game a month; Pro publishes three.",
        ],
      },
      {
        heading: "Get inspired",
        paragraphs: ["Play the games in the Arcade to see what's possible. Every one of them was made by describing it to Nebulux AI."],
      },
    ],
    cta: { label: "Make a game free", to: "/register?returnTo=%2Fchat%2Fgame-designer" },
    more: { label: "Play the Arcade", to: "/arcade" },
    related: ["make-a-website-with-ai", "make-a-website-on-your-phone"],
  },
  {
    slug: "small-business-website",
    title: "How to put your small business online in an afternoon",
    description:
      "A simple plan for a small business website: what to put on it, how to build it with AI, and how to get it in front of customers.",
    minutes: 5,
    intro:
      "Customers look you up before they call, visit or buy. A simple website with the right details wins you those customers, and it doesn't have to take weeks or cost hundreds of dollars. Here's a plan you can finish this afternoon.",
    sections: [
      {
        heading: "What your site needs",
        paragraphs: ["Most small business sites need only a few things. Get these right before anything fancy:"],
        list: [
          "What you do and where, in one sentence at the top",
          "Your services with prices, or your menu",
          "Opening hours and address, with a map link",
          "A phone number people can tap to call, and an email",
          "A few photos and reviews from real customers",
        ],
      },
      {
        heading: "Build it",
        paragraphs: [
          "Start from the Local business or Restaurant template, or describe your business to the Website Designer. Then tell the AI your real details: \"Change the name to Rosa's Bakery, put our hours as 7am to 3pm Tuesday to Sunday, and use these prices...\" You can paste in text you already have, like a menu or a flyer.",
        ],
      },
      {
        heading: "Make contacting you easy",
        paragraphs: [
          "Ask for a big \"Call us\" button that dials your number on a phone, and an email link. Once your site is published, whatever customers send through its booking or contact form arrives in your Messages: open the Website Designer and tap the inbox button on your site. Check it every day, or put your phone number next to the form for anything urgent.",
        ],
      },
      {
        heading: "Get found",
        paragraphs: ["Publish your site, then put the link everywhere customers already look:"],
        list: [
          "The website field of your Google Business Profile",
          "Your Instagram, Facebook and TikTok bios",
          "Business cards, flyers and your shop window, as a QR code",
          "Your email signature and receipts",
        ],
      },
      {
        heading: "Keep it fresh",
        paragraphs: [
          "New hours, a holiday special or a price change takes a minute: open your site, tell the AI what changed and publish again. The link stays the same.",
        ],
      },
      {
        heading: "When you grow",
        paragraphs: [
          "The Team plan, $20 a month, lets up to three people work on your sites and share one pool of AI credits. On Pro and Team you can also download your site's code or push it to GitHub, so it's always yours.",
        ],
      },
    ],
    cta: { label: "Get your business online", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Dbusiness" },
    more: { label: "Try the business template", to: "/templates?preview=business" },
    related: ["make-a-website-with-ai", "resume-website"],
  },
  {
    slug: "resume-website",
    title: "How to make a resume website that stands out",
    description:
      "A personal website shows who you are better than a PDF. Here's what to put on it and how to make one free with AI in a few minutes.",
    minutes: 4,
    intro:
      "A resume website is a link you can put on every application, profile and email. It works on phones, shows your personality and lets you show your work instead of just listing it. Here's how to make one that gets noticed.",
    sections: [
      {
        heading: "What to include",
        list: [
          "Your name and a one-line description of what you do",
          "A short \"about\" paragraph in your own voice",
          "Experience, with a result for each role (\"cut support tickets by a third\")",
          "Projects, with a picture or link for each",
          "Your skills, and a clear button to get in touch",
        ],
      },
      {
        heading: "Build it in minutes",
        paragraphs: [
          "Start from the Resume template (or Portfolio, if your work is visual), then paste in your current resume and ask the AI: \"Fill this page with my details from this resume.\" It rewrites the page with your experience and skills, and you can fix anything by chatting.",
        ],
      },
      {
        heading: "Keep your private details private",
        paragraphs: [
          "Your site is public, so leave off your home address and personal phone number. An email address is enough for recruiters to reach you. You can make a separate email just for job hunting.",
        ],
      },
      {
        heading: "Make it yours",
        list: ["\"Use a dark green color scheme.\"", "\"Add a projects section with three cards.\"", "\"Make my name bigger and add a short tagline under it.\""],
      },
      {
        heading: "Share it",
        paragraphs: [
          "Publish it at yourname.nebuluxai.com, then add the link to your job applications, your LinkedIn profile and your email signature. When something changes, update the page by chatting and publish again. The link stays the same.",
        ],
      },
    ],
    cta: { label: "Make your resume site free", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Dresume" },
    more: { label: "Preview the resume template", to: "/templates?preview=resume" },
    related: ["make-a-website-with-ai", "make-a-website-on-your-phone"],
  },
  {
    slug: "make-a-website-on-your-phone",
    title: "How to make a website on your phone",
    description:
      "No computer? You can build and publish a real website from an iPhone or Android phone. Here's how, step by step, in about ten minutes.",
    minutes: 3,
    intro:
      "You don't need a laptop to make a website. Nebulux AI works in your phone's browser, so you can build, change and publish a real site from the couch or the bus. Here's how.",
    sections: [
      {
        heading: "Step 1: Open Nebulux AI and sign up",
        paragraphs: [
          "Go to nebuluxai.com in Safari, Chrome or any browser and make a free account. There's nothing to download. On Android you can also install it like an app for one-tap access.",
        ],
      },
      {
        heading: "Step 2: Say or type your idea",
        paragraphs: [
          "Open the Website Designer and describe your site. Typing on a phone is slow, so tap the microphone and just say it: \"A website for my nail salon with prices, photos and our hours.\" Your words appear in the box for you to check before you send.",
        ],
      },
      {
        heading: "Step 3: Preview and change it",
        paragraphs: [
          "The preview sits right under the chat, so you see each change as it happens, just as visitors will. Ask for changes one at a time; short requests like \"make the buttons bigger\" work best on a small screen.",
        ],
      },
      {
        heading: "Step 4: Publish and share",
        paragraphs: [
          "Press Publish, pick a name, and your site is live at yourname.nebuluxai.com. Share the link by text, in your social bios, or anywhere else people find you.",
        ],
      },
      {
        heading: "Tips for phone builders",
        list: [
          "Ask for \"big buttons and text that's easy to read on phones\"; your visitors are on phones too.",
          "Start from a template to save typing.",
          "Your work saves on your phone as you go, and once a site is published you can open it again from any device you sign in on.",
        ],
      },
    ],
    cta: { label: "Start building on your phone", to: "/register?returnTo=%2Fchat%2Fdesigner" },
    related: ["make-a-website-with-ai", "make-a-game-without-coding"],
  },
  {
    slug: "link-in-bio-page",
    title: "How to make a free link in bio page",
    description:
      "One link for your Instagram, TikTok or YouTube bio that holds all your other links. Make your own link in bio page free, with your name on it.",
    minutes: 3,
    intro:
      "Most apps only let you put one link in your bio. A link in bio page fixes that: one short address that opens a page with all your links, your photo and a line about you. Here's how to make your own for free, with no monthly fee and no one else's logo on top.",
    sections: [
      {
        heading: "Step 1: Start from the Link in bio template",
        paragraphs: [
          "Open the templates and pick Link in bio. It's already laid out for phones, where almost all your visitors will be: your name at the top, then big buttons that are easy to tap.",
        ],
      },
      {
        heading: "Step 2: Put in your own links",
        paragraphs: [
          "Tell the AI what to add, in plain words: \"Buttons for my YouTube, my TikTok, my shop and my newest video. Put my shop first.\" Paste the full web addresses so every button goes to the right place.",
        ],
      },
      {
        heading: "Step 3: Make it look like you",
        list: [
          "\"Use my colors: black and hot pink.\"",
          "\"Add a short line under my name: gamer, artist, streaming every Friday.\"",
          "\"Make the buttons rounder and add a small icon to each one.\"",
        ],
      },
      {
        heading: "Step 4: Publish and put it in your bio",
        paragraphs: [
          "Publish with a name like yourname.nebuluxai.com and paste that link into every bio you have. When you post something new, change the page and publish again; the link in your bios never needs to change.",
        ],
      },
    ],
    cta: { label: "Make your link in bio page", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Dlinks" },
    more: { label: "Preview the Link in bio template", to: "/templates?preview=links" },
    related: ["make-a-website-on-your-phone", "portfolio-website"],
  },
  {
    slug: "restaurant-website",
    title: "How to make a restaurant website with a menu",
    description:
      "Put your menu, hours and address online in an afternoon. A simple guide to a restaurant or cafe website that looks great on phones, made free with AI.",
    minutes: 4,
    intro:
      "When people look up a place to eat, they want three things fast: the menu, the hours and where you are. A clean, quick website that answers those beats a menu photo nobody can read. Here's how to make one with AI, without a web designer.",
    sections: [
      {
        heading: "What your site needs",
        list: [
          "Your menu as real text, with prices, so it's easy to read on a phone and search engines can find it.",
          "Opening hours for each day, and any days you're closed.",
          "Your address with a link to directions, and a phone number people can tap to call.",
          "A few good photos of your food and your place.",
        ],
      },
      {
        heading: "Step 1: Start from the Restaurant template",
        paragraphs: [
          "Pick the Restaurant menu template. It already has a menu, hours and a location section, so you only have to swap in your own details.",
        ],
      },
      {
        heading: "Step 2: Paste in your menu",
        paragraphs: [
          "Copy your menu from wherever you keep it and paste it into the chat: \"Replace the menu with this one, grouped into starters, mains and drinks.\" The AI lays it out neatly. Read the prices over once before you publish.",
        ],
      },
      {
        heading: "Step 3: Add the details that bring people in",
        list: [
          "\"Add a Call us button and a Get directions button at the top.\"",
          "\"Add a line saying we do takeaway and have vegetarian options.\"",
          "\"Add a small section for today's specials.\"",
        ],
      },
      {
        heading: "Step 4: Publish and keep it fresh",
        paragraphs: [
          "Publish at yourplace.nebuluxai.com and put the link on your Google listing, your social pages and a small QR code by the till. When prices or hours change, update the page by chatting and publish again. The link stays the same.",
        ],
      },
    ],
    cta: { label: "Make your restaurant site free", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Drestaurant" },
    more: { label: "Preview the Restaurant template", to: "/templates?preview=restaurant" },
    related: ["small-business-website", "ai-for-small-business"],
  },
  {
    slug: "portfolio-website",
    title: "How to make a portfolio website to show your work",
    description:
      "Photographers, artists, designers and students: make a clean portfolio website to show off your best work and get hired. Free, with AI, in minutes.",
    minutes: 4,
    intro:
      "A portfolio is the fastest way to show what you can do. Instead of describing your work, you send one link and let it speak for itself. Here's how to make a simple, good-looking portfolio with AI, even if you've never built a website.",
    sections: [
      {
        heading: "Pick your best work, not all of it",
        paragraphs: [
          "Six to twelve strong pieces beat fifty average ones. Choose work that shows the kind of job you want next, and write one line about each: what it was, and what you did.",
        ],
      },
      {
        heading: "Step 1: Start from the Portfolio template",
        paragraphs: [
          "Pick the Portfolio template. It has a big title, a grid for your work, a short about section and a way for people to reach you.",
        ],
      },
      {
        heading: "Step 2: Tell the AI about you",
        paragraphs: [
          "Describe yourself in a sentence or two: \"I'm a wedding and portrait photographer in Leeds. Use my name, Sam Carter, and a calm, light style.\" Then ask it to add your projects and the one line about each.",
        ],
      },
      {
        heading: "Step 3: Make it easy to hire you",
        list: [
          "\"Add a contact form asking for name, email and what they need.\" Messages sent through it arrive in your Messages once the site is published.",
          "\"Add links to my Instagram and my email.\"",
          "\"Add a short list of clients or schools I've worked with.\"",
        ],
      },
      {
        heading: "Step 4: Publish and share it",
        paragraphs: [
          "Publish at yourname.nebuluxai.com and put the link on your applications, your social bios and your email signature. Add new work by chatting and publish again; the link stays the same.",
        ],
      },
    ],
    cta: { label: "Make your portfolio free", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Dportfolio" },
    more: { label: "Preview the Portfolio template", to: "/templates?preview=portfolio" },
    related: ["resume-website", "link-in-bio-page"],
  },
  {
    slug: "event-invite-website",
    title: "How to make an event invite page with RSVP",
    description:
      "Birthday, wedding, party or school event? Make a pretty invite page with a countdown, all the details and an RSVP form, free, and share one link.",
    minutes: 3,
    intro:
      "Group chats bury the details. An invite page keeps the date, the place and what to bring in one spot, counts down to the day, and lets guests say whether they're coming. Here's how to make one in a few minutes.",
    sections: [
      {
        heading: "Step 1: Start from the Event invite template",
        paragraphs: [
          "Pick the Event invite template. It comes with a countdown, a section for the details and an RSVP form.",
        ],
      },
      {
        heading: "Step 2: Fill in your event",
        paragraphs: [
          "Tell the AI the basics in one message: \"It's Maya's 12th birthday, Saturday 14 March at 2pm, at Riverside Park. Bring a swimsuit. Make it bright and fun with balloons.\" It updates the text and the countdown for you.",
        ],
      },
      {
        heading: "Step 3: Collect RSVPs",
        paragraphs: [
          "Once the page is published, every RSVP a guest sends arrives in your Messages, so you can count who's coming. Open the Website Designer and tap the inbox button on your site to see them.",
        ],
      },
      {
        heading: "Keep it safe",
        list: [
          "Don't put a home address on a page anyone can find. Share it by message with people who RSVP instead.",
          "Use first names only for children.",
          "You can take the page down after the event.",
        ],
      },
    ],
    cta: { label: "Make your invite page free", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Devent" },
    more: { label: "Preview the Event invite template", to: "/templates?preview=event" },
    related: ["make-a-website-on-your-phone", "make-a-website-with-ai"],
  },
  {
    slug: "landing-page-for-your-idea",
    title: "How to make a landing page for your app or idea",
    description:
      "Test a product, app or startup idea before you build it. Make a landing page with features, prices and a waitlist sign-up, free with AI, in an hour.",
    minutes: 4,
    intro:
      "Before you spend months building something, find out if people want it. A landing page explains your idea in one screen, and a sign-up form tells you who's interested. Here's how to make one with AI today.",
    sections: [
      {
        heading: "What a good landing page says",
        list: [
          "One headline that says what it does and who it's for, in plain words.",
          "Three short reasons someone would want it.",
          "What it will cost, even roughly, so sign-ups are real interest.",
          "One clear button: join the waitlist, or get early access.",
        ],
      },
      {
        heading: "Step 1: Start from the Product landing template",
        paragraphs: [
          "Pick the Product landing template. It already has a headline, a features section and a pricing section, so you only need your own words.",
        ],
      },
      {
        heading: "Step 2: Describe your idea",
        paragraphs: [
          "Tell the AI in a sentence or two: \"It's an app that reminds students when homework is due and splits big projects into small steps. Free for one class, $2 a month for all of them.\" Ask it to rewrite the headline and features to match.",
        ],
      },
      {
        heading: "Step 3: Add a waitlist",
        paragraphs: [
          "Ask for \"a sign-up form with name and email, and a button that says Join the waitlist\". Once the site is published, every sign-up arrives in your Messages: open the Website Designer and tap the inbox button on your site.",
        ],
      },
      {
        heading: "Step 4: Share it and count the sign-ups",
        paragraphs: [
          "Publish at yourproduct.nebuluxai.com and share the link where your future users are: group chats, forums, social posts. If people sign up, you've found something worth building. If not, change the headline and try again; it only takes a message.",
        ],
      },
    ],
    cta: { label: "Make your landing page free", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Dlanding" },
    more: { label: "Preview the Product landing template", to: "/templates?preview=landing" },
    related: ["make-a-website-with-ai", "ai-for-small-business"],
  },
  {
    slug: "school-club-website",
    title: "How to make a website for your school club",
    description:
      "Robotics, drama, chess or coding club? Make a club website with meeting times, projects and a join form, free with AI. Great for students and teachers.",
    minutes: 3,
    intro:
      "A club website gives new members one place to find out when you meet, what you're working on and how to join. Students can build it themselves in an afternoon, and it's a real project to be proud of. Here's how.",
    sections: [
      {
        heading: "Step 1: Start from the School club template",
        paragraphs: [
          "Pick the School club template. It has a big welcome, a \"When we meet\" section, a place for this year's projects and a join form.",
        ],
      },
      {
        heading: "Step 2: Make it your club",
        paragraphs: [
          "Tell the AI about your club: \"We're the Hillside chess club. We meet Tuesdays at lunch in room 12. Beginners welcome. Use our school colors, green and gold.\" Then add your projects, events or tournament results.",
        ],
      },
      {
        heading: "Step 3: Collect sign-ups",
        paragraphs: [
          "The join form asks for a name and a parent or guardian email. Once the site is published, sign-ups arrive in your Messages, so the club leader can reply.",
        ],
      },
      {
        heading: "Keep it safe for students",
        list: [
          "Use first names only, and no photos of students unless your school allows it.",
          "Don't list home addresses or personal phone numbers.",
          "Ask a teacher to look it over before you share the link.",
        ],
      },
    ],
    cta: { label: "Make your club website free", to: "/register?returnTo=%2Fchat%2Fdesigner%3Ftemplate%3Dclub" },
    more: { label: "Preview the School club template", to: "/templates?preview=club" },
    related: ["event-invite-website", "learn-to-code-with-ai"],
  },
];

export const guideBySlug = (slug) => GUIDES.find((g) => g.slug === slug) || null;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The guide as plain HTML, put inside the app page's #root so search engines and link
// previews read the whole article before the app loads (React replaces it on start).
export function guideHtml(g) {
  const sections = g.sections
    .map(
      (s) =>
        `<h2>${esc(s.heading)}</h2>` +
        (s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("") +
        (s.list ? `<ul>${s.list.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>` : "")
    )
    .join("");
  return (
    `<article style="max-width:720px;margin:0 auto;padding:48px 20px;font:17px/1.7 system-ui,sans-serif;color:#cbd5e1;background:#020617;min-height:100vh">` +
    `<p><a href="/guides" style="color:#a5b4fc">Guides</a></p>` +
    `<h1 style="color:#fff;font-size:36px;line-height:1.2">${esc(g.title)}</h1>` +
    `<p>${esc(g.intro)}</p>${sections}` +
    `<p><a href="${esc(g.cta.to)}" style="color:#a5b4fc">${esc(g.cta.label)}</a></p></article>`
  );
}

// The /guides list as plain HTML, for the same reason.
export function guidesListHtml() {
  const items = GUIDES.map((g) => `<li><a href="/guides/${esc(g.slug)}" style="color:#a5b4fc">${esc(g.title)}</a><br>${esc(g.description)}</li>`).join("");
  return (
    `<main style="max-width:720px;margin:0 auto;padding:48px 20px;font:17px/1.7 system-ui,sans-serif;color:#cbd5e1;background:#020617;min-height:100vh">` +
    `<h1 style="color:#fff">Guides: learn to make things with AI</h1><ul>${items}</ul></main>`
  );
}

// Schema.org Article data for search results. "<" is escaped so the text can't end the
// <script> tag early.
export function guideJsonLd(g, origin) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    dateModified: GUIDES_UPDATED,
    datePublished: GUIDES_UPDATED,
    author: { "@type": "Organization", name: "Nebulux AI", url: origin + "/" },
    publisher: { "@type": "Organization", name: "Nebulux AI", logo: { "@type": "ImageObject", url: origin + "/og-image.jpg" } },
    image: origin + "/og-image.jpg",
    mainEntityOfPage: origin + "/guides/" + g.slug,
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}
