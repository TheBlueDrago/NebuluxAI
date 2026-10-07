// Starter templates for the Website Designer. Picking one opens it in the designer
// (no AI call, so no credits), where the user edits it by chatting or by hand.
// Each is a complete single-file page: no external requests, works on phones.

const base = (title, css, body) =>
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}
img{max-width:100%;display:block}
a{color:inherit}
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;

const portfolio = base(
  "Maya Chen — Photography",
  `:root{--bg:#faf8f5;--ink:#1c1917;--muted:#78716c;--accent:#b45309}
body{background:var(--bg);color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;padding:24px 6vw;flex-wrap:wrap;gap:12px}
.logo{font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:14px}
nav a{margin-left:22px;text-decoration:none;color:var(--muted);font-size:14px}
nav a:hover{color:var(--ink)}
.hero{padding:10vh 6vw 8vh;max-width:900px}
.hero h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(36px,7vw,72px);line-height:1.05}
.hero p{margin-top:20px;color:var(--muted);font-size:18px;max-width:520px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;padding:0 6vw 10vh}
.shot{aspect-ratio:4/5;border-radius:6px;display:flex;align-items:flex-end;padding:16px;color:#fff;font-size:14px}
.s1{background:linear-gradient(160deg,#fcd34d,#b45309)}.s2{background:linear-gradient(160deg,#94a3b8,#1e293b)}
.s3{background:linear-gradient(160deg,#fda4af,#9f1239)}.s4{background:linear-gradient(160deg,#86efac,#166534)}
.s5{background:linear-gradient(160deg,#a5b4fc,#3730a3)}.s6{background:linear-gradient(160deg,#fdba74,#7c2d12)}
.about{display:grid;grid-template-columns:1fr 1fr;gap:6vw;padding:10vh 6vw;border-top:1px solid #e7e5e4}
.about h2{font-family:Georgia,serif;font-weight:400;font-size:36px}
.about p{color:var(--muted);margin-bottom:14px}
.btn{display:inline-block;margin-top:10px;background:var(--ink);color:var(--bg);padding:12px 22px;border-radius:999px;text-decoration:none;font-size:14px}
footer{padding:30px 6vw;color:var(--muted);font-size:13px;border-top:1px solid #e7e5e4}
@media(max-width:700px){.about{grid-template-columns:1fr}nav a{margin:0 16px 0 0}}`,
  `<header><div class="logo">Maya Chen</div><nav><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>
<section class="hero"><h1>Quiet light, honest moments.</h1><p>Portrait and travel photographer based in Lisbon, working with people and brands who like things real.</p></section>
<section class="grid" id="work">
<div class="shot s1">Golden hour, Alfama</div><div class="shot s2">Harbour fog</div><div class="shot s3">Ana, studio</div>
<div class="shot s4">Sintra hills</div><div class="shot s5">Blue hour, Porto</div><div class="shot s6">Market day</div>
</section>
<section class="about" id="about"><h2>About</h2><div><p>I've spent ten years photographing weddings, portraits and small businesses across Europe. I keep sessions relaxed, use natural light, and deliver edited galleries within two weeks.</p><p id="contact">Booking sessions for spring — tell me what you have in mind.</p><a class="btn" href="mailto:hello@example.com">Get in touch</a></div></section>
<footer>© Maya Chen Photography</footer>`
);

const restaurant = base(
  "Olive & Ember — Menu",
  `:root{--bg:#14110f;--card:#1f1a17;--ink:#f5efe6;--muted:#a8a29e;--accent:#f59e0b}
body{background:var(--bg);color:var(--ink)}
.hero{min-height:62vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px 20px;background:radial-gradient(circle at 50% 30%,#7c2d12 0,#14110f 70%)}
.hero small{letter-spacing:.3em;text-transform:uppercase;color:var(--accent);font-size:12px}
.hero h1{font-family:Georgia,serif;font-size:clamp(40px,8vw,80px);font-weight:400;margin:10px 0}
.hero p{color:var(--muted);max-width:460px}
.tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:30px 16px 0;position:sticky;top:0;background:var(--bg);z-index:2}
.tabs a{padding:8px 16px;border:1px solid #44403c;border-radius:999px;text-decoration:none;font-size:14px;color:var(--muted)}
.tabs a:hover{color:var(--ink);border-color:var(--accent)}
.menu{max-width:760px;margin:0 auto;padding:20px 20px 60px}
.menu h2{font-family:Georgia,serif;font-weight:400;font-size:30px;margin:40px 0 14px;color:var(--accent)}
.item{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px dashed #3a332e}
.item b{font-weight:600}.item span{color:var(--muted);font-size:14px;display:block}
.price{color:var(--accent);font-weight:600;white-space:nowrap}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;max-width:760px;margin:0 auto 60px;padding:0 20px}
.info div{background:var(--card);border-radius:14px;padding:20px}
.info h3{font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
.info p{color:var(--muted);font-size:14px}`,
  `<section class="hero"><small>Wood-fired kitchen</small><h1>Olive &amp; Ember</h1><p>Seasonal Mediterranean plates cooked over open flame. Walk-ins welcome.</p></section>
<nav class="tabs"><a href="#starters">Starters</a><a href="#mains">Mains</a><a href="#desserts">Desserts</a><a href="#visit">Visit</a></nav>
<section class="menu">
<h2 id="starters">Starters</h2>
<div class="item"><div><b>Charred flatbread</b><span>Whipped feta, hot honey, za'atar</span></div><div class="price">$9</div></div>
<div class="item"><div><b>Grilled halloumi</b><span>Blood orange, mint, pistachio</span></div><div class="price">$12</div></div>
<div class="item"><div><b>Ember-roasted peppers</b><span>Garlic confit, sourdough</span></div><div class="price">$10</div></div>
<h2 id="mains">Mains</h2>
<div class="item"><div><b>Lamb skewers</b><span>Saffron rice, yogurt, sumac onions</span></div><div class="price">$24</div></div>
<div class="item"><div><b>Whole sea bream</b><span>Lemon, capers, wild greens</span></div><div class="price">$28</div></div>
<div class="item"><div><b>Smoked aubergine</b><span>Tahini, pomegranate, herbs (v)</span></div><div class="price">$19</div></div>
<h2 id="desserts">Desserts</h2>
<div class="item"><div><b>Olive oil cake</b><span>Citrus, crème fraîche</span></div><div class="price">$8</div></div>
<div class="item"><div><b>Burnt honey ice cream</b><span>Sesame brittle</span></div><div class="price">$7</div></div>
</section>
<section class="info" id="visit"><div><h3>Hours</h3><p>Tue–Sun · 5pm–11pm</p></div><div><h3>Find us</h3><p>12 Harbour Street</p></div><div><h3>Book</h3><p>(555) 014-2290</p></div></section>`
);

const landing = base(
  "Flowly — Focus, finally",
  `:root{--bg:#0b1020;--ink:#e6e9f5;--muted:#8b93b3;--a:#6366f1;--b:#22d3ee}
body{background:var(--bg);color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 6vw}
.logo{font-weight:800;font-size:20px}.logo i{font-style:normal;background:linear-gradient(90deg,var(--a),var(--b));-webkit-background-clip:text;background-clip:text;color:transparent}
.cta{background:linear-gradient(90deg,var(--a),var(--b));color:#fff;border:0;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;display:inline-block}
.hero{text-align:center;padding:12vh 6vw 8vh;max-width:860px;margin:0 auto}
.pill{display:inline-block;border:1px solid #27304f;border-radius:999px;padding:6px 14px;font-size:13px;color:var(--muted)}
.hero h1{font-size:clamp(38px,7vw,68px);line-height:1.05;margin:22px 0;font-weight:800}
.hero p{color:var(--muted);font-size:18px;max-width:560px;margin:0 auto 30px}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;padding:4vh 6vw 10vh;max-width:1100px;margin:0 auto}
.f{background:#121933;border:1px solid #1f2847;border-radius:18px;padding:24px}
.f .ic{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--a),var(--b));margin-bottom:14px}
.f h3{margin-bottom:6px}.f p{color:var(--muted);font-size:15px}
.pricing{text-align:center;padding:0 6vw 12vh}
.plan{display:inline-block;background:#121933;border:1px solid var(--a);border-radius:22px;padding:34px 40px;margin-top:24px}
.plan .n{font-size:48px;font-weight:800}.plan .n small{font-size:16px;color:var(--muted);font-weight:400}
.plan ul{list-style:none;margin:16px 0 22px;color:var(--muted);text-align:left}
footer{text-align:center;color:var(--muted);font-size:13px;padding:30px}`,
  `<header><div class="logo">Flow<i>ly</i></div><a class="cta" href="#pricing">Get started</a></header>
<section class="hero"><span class="pill">New · Smart focus sessions</span><h1>Do your best work, without the noise.</h1><p>Flowly blocks distractions, plans your deep-work blocks and shows how your focus improves week by week.</p><a class="cta" href="#pricing">Start free for 14 days</a></section>
<section class="features">
<div class="f"><div class="ic"></div><h3>Focus sessions</h3><p>One click silences notifications and distracting sites for as long as you need.</p></div>
<div class="f"><div class="ic"></div><h3>Smart planning</h3><p>Flowly finds the hours you focus best and books them before meetings do.</p></div>
<div class="f"><div class="ic"></div><h3>Weekly insights</h3><p>See where your time went and what helped, in a two-minute report.</p></div>
</section>
<section class="pricing" id="pricing"><h2>Simple pricing</h2><div class="plan"><div class="n">$6<small>/month</small></div><ul><li>✓ Unlimited focus sessions</li><li>✓ Calendar sync</li><li>✓ Weekly insights</li></ul><a class="cta" href="#">Try it free</a></div></section>
<footer>© Flowly</footer>`
);

const links = base(
  "Jordan Lee — Links",
  `body{min-height:100vh;background:linear-gradient(160deg,#fde68a,#f472b6 50%,#818cf8);display:flex;justify-content:center;padding:60px 18px;color:#1f1b2e}
.card{width:100%;max-width:420px;text-align:center}
.avatar{width:96px;height:96px;border-radius:50%;margin:0 auto 14px;background:#1f1b2e;color:#fde68a;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;border:4px solid #fff}
h1{font-size:24px}.bio{margin:6px 0 26px;opacity:.8}
.link{display:block;background:rgba(255,255,255,.85);border-radius:16px;padding:16px;margin-bottom:12px;text-decoration:none;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.08);transition:transform .15s}
.link:hover{transform:translateY(-2px)}
.social{margin-top:24px;display:flex;gap:10px;justify-content:center}
.social a{width:42px;height:42px;border-radius:50%;background:#1f1b2e;color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px;font-weight:700}`,
  `<main class="card"><div class="avatar">J</div><h1>Jordan Lee</h1><p class="bio">Musician · producer · making lo-fi beats every Friday</p>
<a class="link" href="#">🎧 New EP — "Late Trains"</a><a class="link" href="#">📺 Watch the studio sessions</a><a class="link" href="#">🎟️ Tour dates</a><a class="link" href="#">✉️ Booking &amp; collabs</a>
<div class="social"><a href="#">IG</a><a href="#">YT</a><a href="#">SP</a><a href="#">TT</a></div></main>`
);

const business = base(
  "Bright Paws Grooming",
  `:root{--bg:#f0fdfa;--ink:#134e4a;--muted:#5f7f7b;--accent:#f97316;--card:#fff}
body{background:var(--bg);color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 6vw;flex-wrap:wrap;gap:10px}
.logo{font-weight:800;font-size:20px}.logo span{color:var(--accent)}
nav a{margin-left:18px;text-decoration:none;color:var(--muted);font-weight:600;font-size:14px}
.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:5vw;align-items:center;padding:6vh 6vw 8vh}
.hero h1{font-size:clamp(34px,6vw,58px);line-height:1.05}
.hero p{margin:16px 0 24px;color:var(--muted);font-size:18px}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:700;border:0;cursor:pointer;font-size:15px}
.pic{aspect-ratio:1;border-radius:32px;background:radial-gradient(circle at 35% 35%,#fdba74,#f97316 45%,#0d9488 46%,#115e59);display:flex;align-items:center;justify-content:center;font-size:90px}
.services{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;padding:0 6vw 8vh}
.card{background:var(--card);border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(19,78,74,.08)}
.card b{display:block;font-size:18px}.card small{color:var(--muted)}.card .p{margin-top:10px;color:var(--accent);font-weight:800;font-size:20px}
.book{max-width:560px;margin:0 auto 8vh;background:var(--card);border-radius:24px;padding:28px;box-shadow:0 8px 24px rgba(19,78,74,.08)}
.book h2{margin-bottom:14px}
.book input,.book select{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:10px;font-size:15px}
.ok{display:none;margin-top:12px;color:#15803d;font-weight:700}
.hours{text-align:center;color:var(--muted);padding:0 6vw 8vh}
footer{text-align:center;padding:24px;color:var(--muted);font-size:13px}
@media(max-width:760px){.hero{grid-template-columns:1fr}}`,
  `<header><div class="logo">Bright <span>Paws</span></div><nav><a href="#services">Services</a><a href="#book">Book</a><a href="#hours">Hours</a></nav></header>
<section class="hero"><div><h1>Happy, clean pups. Every time.</h1><p>Gentle grooming for dogs of every size, by people who love them. Walk-ins welcome on weekdays.</p><a class="btn" href="#book">Book a visit</a></div><div class="pic">🐶</div></section>
<section class="services" id="services">
<div class="card"><b>Bath &amp; brush</b><small>Shampoo, dry, brush-out, nails</small><div class="p">$35</div></div>
<div class="card"><b>Full groom</b><small>Bath plus a breed-style haircut</small><div class="p">$60</div></div>
<div class="card"><b>Puppy intro</b><small>A gentle first visit for pups under 6 months</small><div class="p">$25</div></div>
<div class="card"><b>Nail trim</b><small>Quick in-and-out, no appointment</small><div class="p">$12</div></div>
</section>
<section class="book" id="book"><h2>Book a visit</h2>
<form onsubmit="event.preventDefault();this.querySelector('.ok').style.display='block';this.reset();">
<input required placeholder="Your name"><input required type="tel" placeholder="Phone number"><input required placeholder="Your dog's name">
<select required><option value="">Choose a service</option><option>Bath &amp; brush</option><option>Full groom</option><option>Puppy intro</option><option>Nail trim</option></select>
<input required type="date"><button class="btn" type="submit">Request appointment</button>
<p class="ok">Thanks! We'll text you to confirm the time.</p></form></section>
<p class="hours" id="hours">Open Mon–Fri 9am–6pm · Sat 9am–3pm · 123 Main Street</p>
<footer>© Bright Paws Grooming</footer>`
);

const event = base(
  "Maya & Leo's Wedding",
  `:root{--bg:#fff7f5;--ink:#3f2a2a;--muted:#8c6f6f;--accent:#be7c6d}
body{background:var(--bg);color:var(--ink);text-align:center}
.hero{padding:14vh 20px 10vh;background:radial-gradient(circle at 50% 0,#fde2dc,transparent 70%)}
.hero small{letter-spacing:.3em;text-transform:uppercase;color:var(--accent);font-size:12px}
.hero h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(44px,9vw,86px);margin:14px 0}
.hero p{color:var(--muted);font-size:18px}
.count{display:flex;gap:12px;justify-content:center;margin:34px 0 0;flex-wrap:wrap}
.count div{background:#fff;border-radius:16px;padding:16px 18px;min-width:78px;box-shadow:0 6px 20px rgba(63,42,42,.06)}
.count b{display:block;font-size:30px;font-family:Georgia,serif}.count span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.details{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:820px;margin:0 auto;padding:6vh 20px}
.details div{background:#fff;border-radius:18px;padding:24px}
.details h3{font-family:Georgia,serif;font-weight:400;font-size:24px;margin-bottom:6px}.details p{color:var(--muted)}
.rsvp{max-width:480px;margin:0 auto 10vh;padding:0 20px}
.rsvp h2{font-family:Georgia,serif;font-weight:400;font-size:36px;margin-bottom:16px}
.rsvp input,.rsvp select{width:100%;padding:13px;border:1px solid #e7d3cf;border-radius:12px;margin-bottom:10px;font-size:15px;background:#fff}
.btn{background:var(--accent);color:#fff;border:0;padding:14px 28px;border-radius:999px;font-size:15px;cursor:pointer}
.ok{display:none;margin-top:14px;color:var(--accent);font-weight:700}
footer{padding:24px;color:var(--muted);font-size:13px}`,
  `<section class="hero"><small>We're getting married</small><h1>Maya &amp; Leo</h1><p>Saturday, June 12 · Sonoma, California</p>
<div class="count"><div><b id="d">0</b><span>days</span></div><div><b id="h">0</b><span>hours</span></div><div><b id="m">0</b><span>minutes</span></div></div></section>
<section class="details"><div><h3>Ceremony</h3><p>4:00 pm at the Old Mill Garden</p></div><div><h3>Dinner</h3><p>6:00 pm in the Barn Hall</p></div><div><h3>Dress code</h3><p>Garden party: light colors, comfy shoes</p></div></section>
<section class="rsvp"><h2>Will you join us?</h2>
<form onsubmit="event.preventDefault();this.querySelector('.ok').style.display='block';this.reset();">
<input required placeholder="Your name"><input required type="email" placeholder="Email"><select required><option value="">Can you come?</option><option>Yes, can't wait!</option><option>Sadly, no</option></select>
<input type="number" min="1" max="6" placeholder="How many guests?"><button class="btn" type="submit">Send RSVP</button><p class="ok">Thank you! We've got your RSVP.</p></form></section>
<footer>Made with love by Maya &amp; Leo</footer>
<script>
(function(){var t=new Date();t=new Date(t.getFullYear()+(t.getMonth()>5?1:0),5,12,16,0,0);
function tick(){var s=Math.max(0,(t-new Date())/1000);document.getElementById('d').textContent=Math.floor(s/86400);document.getElementById('h').textContent=Math.floor(s%86400/3600);document.getElementById('m').textContent=Math.floor(s%3600/60);}
tick();setInterval(tick,30000);})();
</script>`
);

const club = base(
  "Westfield Robotics Club",
  `:root{--bg:#0b1020;--card:#141b33;--ink:#e2e8f0;--muted:#94a3b8;--accent:#22d3ee}
body{background:var(--bg);color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 6vw;flex-wrap:wrap;gap:10px}
.logo{font-weight:800}.logo span{color:var(--accent)}
nav a{margin-left:18px;color:var(--muted);text-decoration:none;font-size:14px}
.hero{padding:10vh 6vw 8vh;max-width:860px}
.hero h1{font-size:clamp(36px,7vw,68px);line-height:1.05}.hero h1 span{color:var(--accent)}
.hero p{margin:18px 0 26px;color:var(--muted);font-size:18px;max-width:560px}
.btn{display:inline-block;background:var(--accent);color:#06202a;padding:13px 24px;border-radius:12px;font-weight:800;text-decoration:none;border:0;cursor:pointer;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;padding:0 6vw 8vh}
.card{background:var(--card);border:1px solid #1f2a4d;border-radius:18px;padding:22px}
.card .ic{font-size:28px}.card h3{margin:10px 0 6px}.card p{color:var(--muted);font-size:15px}
h2{padding:0 6vw;margin-bottom:16px;font-size:28px}
.join{max-width:560px;margin:0 6vw 10vh;background:var(--card);border:1px solid #1f2a4d;border-radius:20px;padding:26px}
.join input,.join select{width:100%;padding:12px;border-radius:10px;border:1px solid #2a3760;background:#0b1020;color:var(--ink);margin-bottom:10px;font-size:15px}
.ok{display:none;margin-top:12px;color:var(--accent);font-weight:700}
footer{padding:24px 6vw;color:var(--muted);font-size:13px;border-top:1px solid #1f2a4d}`,
  `<header><div class="logo">Westfield <span>Robotics</span></div><nav><a href="#meet">Meetings</a><a href="#projects">Projects</a><a href="#join">Join</a></nav></header>
<section class="hero"><h1>We build robots that <span>actually move.</span></h1><p>A club for students in grades 6–12 who like to build, code and compete. No experience needed: we'll teach you.</p><a class="btn" href="#join">Join the club</a></section>
<h2 id="meet">When we meet</h2>
<section class="grid"><div class="card"><div class="ic">🛠️</div><h3>Build nights</h3><p>Tuesdays 3:30–5:30 pm in Room 214</p></div><div class="card"><div class="ic">💻</div><h3>Code lab</h3><p>Thursdays 3:30–5 pm in the computer lab</p></div><div class="card"><div class="ic">🏆</div><h3>Competitions</h3><p>Regional tournament in March, state in April</p></div></section>
<h2 id="projects">This year's projects</h2>
<section class="grid"><div class="card"><div class="ic">🤖</div><h3>Line-following racer</h3><p>A small robot that races around a taped track on its own.</p></div><div class="card"><div class="ic">🦾</div><h3>Robotic arm</h3><p>Picks up blocks and sorts them by color with a camera.</p></div><div class="card"><div class="ic">🚀</div><h3>Mars rover</h3><p>Our competition bot: six wheels, one very brave driver.</p></div></section>
<section class="join" id="join"><h2 style="padding:0">Join us</h2>
<form onsubmit="event.preventDefault();this.querySelector('.ok').style.display='block';this.reset();">
<input required placeholder="Your name"><select required><option value="">Your grade</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option></select><input required type="email" placeholder="Parent or guardian email">
<button class="btn" type="submit">Sign me up</button><p class="ok">You're on the list! See you at build night.</p></form></section>
<footer>© Westfield Robotics Club · Faculty advisor: Ms. Rivera</footer>`
);

const resume = base(
  "Sam Rivera — Resume",
  `:root{--bg:#ffffff;--ink:#0f172a;--muted:#64748b;--accent:#4f46e5;--line:#e2e8f0}
body{background:var(--bg);color:var(--ink)}
.wrap{max-width:820px;margin:0 auto;padding:8vh 24px}
.top{display:flex;gap:22px;align-items:center;flex-wrap:wrap}
.av{width:88px;height:88px;border-radius:24px;background:linear-gradient(135deg,#818cf8,#4f46e5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800}
h1{font-size:clamp(30px,5vw,44px)}.role{color:var(--accent);font-weight:700}
.links{margin-top:8px;display:flex;gap:14px;flex-wrap:wrap}.links a{color:var(--muted);text-decoration:none;font-size:14px}
h2{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:44px 0 14px}
.about{font-size:18px;color:#334155;line-height:1.7}
.job{display:grid;grid-template-columns:150px 1fr;gap:18px;padding:16px 0;border-top:1px solid var(--line)}
.job .when{color:var(--muted);font-size:14px}.job b{display:block}.job span{color:var(--muted);font-size:15px}
.skills{display:flex;flex-wrap:wrap;gap:8px}.skills span{background:#eef2ff;color:var(--accent);padding:7px 13px;border-radius:999px;font-size:14px;font-weight:600}
.btn{display:inline-block;margin-top:30px;background:var(--ink);color:#fff;padding:13px 24px;border-radius:12px;text-decoration:none;font-weight:700}
@media(max-width:600px){.job{grid-template-columns:1fr;gap:4px}}`,
  `<main class="wrap"><section class="top"><div class="av">SR</div><div><h1>Sam Rivera</h1><div class="role">Product designer</div><div class="links"><a href="mailto:sam@example.com">sam@example.com</a><a href="#">Portfolio</a><a href="#">LinkedIn</a></div></div></section>
<h2>About</h2><p class="about">I design simple, friendly apps for people who don't have time to learn complicated ones. Five years of turning messy problems into clear screens, working closely with engineers and customers.</p>
<h2>Experience</h2>
<div class="job"><div class="when">2023 – now</div><div><b>Senior designer, Northwind Health</b><span>Redesigned the patient app; sign-ups up 40% and support tickets down by a third.</span></div></div>
<div class="job"><div class="when">2021 – 2023</div><div><b>Product designer, Fable Books</b><span>Led the reading app's first accessibility overhaul and a new onboarding flow.</span></div></div>
<div class="job"><div class="when">2019 – 2021</div><div><b>UX intern → designer, Brightside Studio</b><span>Websites and brand kits for 20+ small businesses.</span></div></div>
<h2>Skills</h2><div class="skills"><span>User research</span><span>Prototyping</span><span>Design systems</span><span>Accessibility</span><span>Figma</span><span>HTML &amp; CSS</span></div>
<a class="btn" href="mailto:sam@example.com">Get in touch</a></main>`
);

const store = base(
  "Sunny Socks — Shop",
  `:root{--bg:#fffdf7;--ink:#1f2937;--muted:#6b7280;--accent:#f59e0b;--card:#fff}
body{background:var(--bg);color:var(--ink)}
header{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:16px 6vw;background:rgba(255,253,247,.92);backdrop-filter:blur(8px);border-bottom:1px solid #f3e8c8}
.logo{font-weight:800;font-size:20px}.logo span{color:var(--accent)}
.cart-btn{border:0;background:var(--ink);color:#fff;border-radius:999px;padding:9px 16px;font:inherit;font-size:15px;cursor:pointer}
.hero{padding:9vh 6vw 6vh;text-align:center}
.hero h1{font-size:clamp(34px,6vw,60px);line-height:1.1}
.hero p{color:var(--muted);margin-top:12px;font-size:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;padding:0 6vw 8vh}
.item{background:var(--card);border:1px solid #f1e6c6;border-radius:16px;padding:14px;display:flex;flex-direction:column}
.pic{aspect-ratio:1;border-radius:12px;margin-bottom:12px}
.p1{background:repeating-linear-gradient(45deg,#fde68a 0 14px,#f59e0b 14px 28px)}.p2{background:repeating-linear-gradient(0deg,#bfdbfe 0 12px,#3b82f6 12px 24px)}
.p3{background:radial-gradient(circle at 30% 30%,#f9a8d4 0 18%,#fdf2f8 19%);background-size:40px 40px}.p4{background:repeating-linear-gradient(90deg,#bbf7d0 0 16px,#22c55e 16px 32px)}
.item h3{font-size:17px}.price{color:var(--muted);margin:4px 0 12px}
.add{margin-top:auto;border:0;background:var(--accent);color:#1f2937;font-weight:700;border-radius:10px;padding:10px;font:inherit;cursor:pointer}
.add:active{transform:scale(.98)}
.panel{position:fixed;inset:0 0 0 auto;width:min(380px,100%);background:#fff;box-shadow:-10px 0 40px rgba(0,0,0,.15);padding:22px;transform:translateX(100%);transition:transform .25s;z-index:10;display:flex;flex-direction:column}
.panel.open{transform:none}
.panel h2{display:flex;justify-content:space-between;align-items:center}
.close{border:0;background:none;font-size:26px;cursor:pointer}
.lines{flex:1;overflow:auto;margin:16px 0}.line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6}
.total{font-weight:700;font-size:18px;display:flex;justify-content:space-between}
.checkout{margin-top:14px;border:0;background:var(--ink);color:#fff;border-radius:12px;padding:12px;font:inherit;font-weight:600;cursor:pointer}
footer{text-align:center;color:var(--muted);padding:30px;font-size:14px}`,
  `<header><div class="logo">Sunny<span>Socks</span></div><button class="cart-btn" onclick="toggleCart(true)">Cart (<span id="count">0</span>)</button></header>
<section class="hero"><h1>Happy socks for happy feet</h1><p>Soft, bright and made to last. Free shipping over $30.</p></section>
<section class="grid">
  <div class="item"><div class="pic p1"></div><h3>Sunshine Stripes</h3><p class="price">$9</p><button class="add" onclick="add('Sunshine Stripes',9)">Add to cart</button></div>
  <div class="item"><div class="pic p2"></div><h3>Ocean Waves</h3><p class="price">$9</p><button class="add" onclick="add('Ocean Waves',9)">Add to cart</button></div>
  <div class="item"><div class="pic p3"></div><h3>Pink Polka</h3><p class="price">$11</p><button class="add" onclick="add('Pink Polka',11)">Add to cart</button></div>
  <div class="item"><div class="pic p4"></div><h3>Garden Green</h3><p class="price">$10</p><button class="add" onclick="add('Garden Green',10)">Add to cart</button></div>
</section>
<aside class="panel" id="panel" aria-label="Your cart"><h2>Your cart <button class="close" onclick="toggleCart(false)" aria-label="Close">×</button></h2><div class="lines" id="lines"><p style="color:#6b7280">Your cart is empty.</p></div><div class="total"><span>Total</span><span id="total">$0</span></div><button class="checkout" onclick="alert('Ask the AI to set up selling to take real payments.')">Checkout</button></aside>
<footer>© Sunny Socks · Made with love</footer>
<script>
var cart = {};
function add(name, price) { cart[name] = cart[name] || { price: price, qty: 0 }; cart[name].qty++; draw(); toggleCart(true); }
function draw() {
  var lines = document.getElementById("lines"), total = 0, count = 0, html = "";
  for (var n in cart) { var c = cart[n]; total += c.price * c.qty; count += c.qty; html += '<div class="line"><span>' + n + ' × ' + c.qty + '</span><span>$' + c.price * c.qty + '</span></div>'; }
  lines.innerHTML = html || '<p style="color:#6b7280">Your cart is empty.</p>';
  document.getElementById("total").textContent = "$" + total;
  document.getElementById("count").textContent = count;
}
function toggleCart(open) { document.getElementById("panel").classList.toggle("open", open); }
</script>`
);

const blog = base(
  "Notes from the Trail — Blog",
  `:root{--bg:#fbfaf8;--ink:#222;--muted:#6f6a64;--accent:#2f6f5e}
body{background:var(--bg);color:var(--ink)}
header{max-width:760px;margin:0 auto;padding:40px 22px 10px}
header h1{font-family:Georgia,serif;font-size:clamp(30px,5vw,44px)}
header p{color:var(--muted);margin-top:6px}
nav{margin-top:16px;display:flex;gap:16px;flex-wrap:wrap}
nav button{border:0;background:none;color:var(--muted);font:inherit;cursor:pointer;padding:4px 0;border-bottom:2px solid transparent}
nav button.on{color:var(--accent);border-color:var(--accent)}
main{max-width:760px;margin:0 auto;padding:10px 22px 60px}
article{padding:28px 0;border-bottom:1px solid #e7e3dc}
.tag{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:600}
article h2{font-family:Georgia,serif;font-size:26px;margin:6px 0}
.meta{color:var(--muted);font-size:14px}
article p{margin-top:10px}
.more{margin-top:10px;display:inline-block;color:var(--accent);font-weight:600;cursor:pointer;border:0;background:none;font:inherit;padding:0}
.full{display:none;margin-top:10px}
.sub{margin-top:40px;background:#eef4f1;border-radius:16px;padding:22px}
.sub form{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.sub input{flex:1;min-width:200px;padding:11px 12px;border-radius:10px;border:1px solid #cfdcd6;font:inherit;font-size:16px}
.sub button{border:0;background:var(--accent);color:#fff;border-radius:10px;padding:11px 16px;font:inherit;font-weight:600;cursor:pointer}`,
  `<header><h1>Notes from the Trail</h1><p>Hiking, camping and the small joys of being outside.</p>
<nav id="tags"><button class="on" onclick="show('all',this)">All</button><button onclick="show('hikes',this)">Hikes</button><button onclick="show('gear',this)">Gear</button><button onclick="show('tips',this)">Tips</button></nav></header>
<main>
  <article data-tag="hikes"><span class="tag">Hikes</span><h2>Sunrise at Eagle Peak</h2><p class="meta">October 3 · 5 min read</p><p>We started at 4 a.m. with headlamps and cold hands. By the top, the whole valley was glowing orange.</p><div class="full"><p>The trail is steep for the first mile, then opens into meadows. Bring layers: it was freezing at the summit and warm an hour later.</p></div><button class="more" onclick="more(this)">Read more →</button></article>
  <article data-tag="gear"><span class="tag">Gear</span><h2>My 10 must-haves for a day hike</h2><p class="meta">September 21 · 4 min read</p><p>You don't need fancy gear. Here's what I actually carry every time.</p><div class="full"><p>Water, snacks, a light jacket, sunscreen, a map, a small first-aid kit, a headlamp, a phone, a whistle, and a good attitude.</p></div><button class="more" onclick="more(this)">Read more →</button></article>
  <article data-tag="tips"><span class="tag">Tips</span><h2>How to start hiking (even if you're not sporty)</h2><p class="meta">September 9 · 6 min read</p><p>Start short, go slow, and pick trails with a view at the end. It gets easier fast.</p><div class="full"><p>Try a 2-mile loop first. Go with a friend. Check the weather. Turn back if it doesn't feel right; the mountain will be there next week.</p></div><button class="more" onclick="more(this)">Read more →</button></article>
  <section class="sub"><h3>Get new posts by email</h3><p style="color:#6f6a64">About one a week. No spam.</p><form onsubmit="event.preventDefault();this.innerHTML='<p>Thanks! You\\'re subscribed.</p>'"><input type="email" required placeholder="you@example.com" aria-label="Your email"><button>Subscribe</button></form></section>
</main>
<script>
function show(tag, btn) {
  document.querySelectorAll("nav button").forEach(function (b) { b.classList.toggle("on", b === btn); });
  document.querySelectorAll("article").forEach(function (a) { a.style.display = tag === "all" || a.dataset.tag === tag ? "" : "none"; });
}
function more(btn) {
  var full = btn.previousElementSibling, open = full.style.display === "block";
  full.style.display = open ? "none" : "block";
  btn.textContent = open ? "Read more →" : "Show less ↑";
}
</script>`
);

const team = base(
  "Nova Squad — Gaming Team",
  `:root{--bg:#0b0b14;--ink:#eef0ff;--muted:#9aa0c3;--accent:#7c5cff;--accent2:#22d3ee}
body{background:var(--bg);color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 6vw;flex-wrap:wrap;gap:10px}
.logo{font-weight:900;font-size:22px;letter-spacing:.04em}.logo span{color:var(--accent2)}
nav a{margin-left:18px;text-decoration:none;color:var(--muted);font-size:15px}
.hero{padding:10vh 6vw 8vh;text-align:center;background:radial-gradient(ellipse at top,rgba(124,92,255,.35),transparent 60%)}
.hero h1{font-size:clamp(38px,8vw,80px);font-weight:900;line-height:1}
.hero p{color:var(--muted);margin-top:14px;font-size:18px}
.btn{display:inline-block;margin-top:24px;background:linear-gradient(90deg,var(--accent),var(--accent2));color:#0b0b14;font-weight:800;padding:12px 22px;border-radius:12px;text-decoration:none}
section{padding:6vh 6vw}
h2{font-size:28px;margin-bottom:18px}
.roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.player{background:#151528;border:1px solid #26264a;border-radius:16px;padding:16px;text-align:center}
.av{width:64px;height:64px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:24px;color:#0b0b14}
.player p{color:var(--muted);font-size:14px}
table{width:100%;border-collapse:collapse;background:#151528;border-radius:16px;overflow:hidden}
td,th{padding:12px 14px;text-align:left;border-bottom:1px solid #26264a}th{color:var(--muted);font-weight:600;font-size:14px}
.win{color:#4ade80;font-weight:700}.loss{color:#f87171;font-weight:700}
form{display:grid;gap:10px;max-width:460px}
input,select{padding:11px 12px;border-radius:10px;border:1px solid #2b2b52;background:#151528;color:var(--ink);font:inherit;font-size:16px}
form button{border:0;background:var(--accent);color:#fff;font-weight:700;border-radius:10px;padding:12px;font:inherit;cursor:pointer}
footer{text-align:center;color:var(--muted);padding:30px;font-size:14px}`,
  `<header><div class="logo">NOVA<span>SQUAD</span></div><nav><a href="#roster">Roster</a><a href="#matches">Matches</a><a href="#join">Join</a></nav></header>
<section class="hero"><h1>WE PLAY TO WIN</h1><p>A friendly competitive team. Weekly scrims, tournaments and good vibes.</p><a class="btn" href="#join">Try out for the team</a></section>
<section id="roster"><h2>Roster</h2><div class="roster">
  <div class="player"><div class="av" style="background:#7c5cff">Z</div><b>Zephyr</b><p>Captain · Strategy</p></div>
  <div class="player"><div class="av" style="background:#22d3ee">K</div><b>Kitsune</b><p>Builder · Defense</p></div>
  <div class="player"><div class="av" style="background:#f472b6">R</div><b>Rook</b><p>Rusher · Attack</p></div>
  <div class="player"><div class="av" style="background:#facc15">P</div><b>Pixel</b><p>Support · Scout</p></div>
</div></section>
<section id="matches"><h2>Recent matches</h2><table><tr><th>Opponent</th><th>Date</th><th>Result</th></tr>
<tr><td>Iron Wolves</td><td>Oct 4</td><td class="win">Win 3–1</td></tr>
<tr><td>Red Comets</td><td>Sep 27</td><td class="win">Win 2–0</td></tr>
<tr><td>Shadow Byte</td><td>Sep 20</td><td class="loss">Loss 1–2</td></tr></table></section>
<section id="join"><h2>Join the squad</h2><form onsubmit="event.preventDefault();this.innerHTML='<p>Thanks! The captain will message you soon. GG!</p>'">
<input required placeholder="Your gamer tag" aria-label="Gamer tag"><select aria-label="Role"><option>Attack</option><option>Defense</option><option>Support</option><option>Any role</option></select><input placeholder="What games do you play?" aria-label="Games"><button>Send tryout request</button></form></section>
<footer>© Nova Squad · GG WP</footer>`
);

export const SITE_TEMPLATES = [
  { id: "portfolio", title: "Portfolio", blurb: "Photographer or creative", html: portfolio },
  { id: "restaurant", title: "Restaurant menu", blurb: "Menu, hours and location", html: restaurant },
  { id: "landing", title: "Product landing", blurb: "Features and pricing", html: landing },
  { id: "links", title: "Link in bio", blurb: "All your links on one page", html: links },
  { id: "business", title: "Local business", blurb: "Services, prices and booking", html: business },
  { id: "event", title: "Event invite", blurb: "Countdown and RSVP", html: event },
  { id: "club", title: "School club", blurb: "Meetings, projects, join form", html: club },
  { id: "resume", title: "Resume", blurb: "Experience and skills", html: resume },
  { id: "store", title: "Online store", blurb: "Products and a cart", html: store },
  { id: "blog", title: "Blog", blurb: "Posts, topics and email sign-up", html: blog },
  { id: "team", title: "Gaming team", blurb: "Roster, matches and tryouts", html: team },
];
