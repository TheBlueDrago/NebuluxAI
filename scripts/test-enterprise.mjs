// Offline test for Enterprise applications (cloudflare-lib/enterprise.js).
// Run: node scripts/test-enterprise.mjs
const R = new URL("../", import.meta.url).pathname;
const { validateApplication, quoteFor, warningsFor } = await import(R + "cloudflare-lib/enterprise.js");
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const good = {
  orgName: "Acme Bakery LLC", entityType: "llc", region: "Texas", regNumber: "12-3456789", website: "acmebakery.com",
  contactName: "Sam Lee", role: "Owner", workEmail: "sam@acmebakery.com", phone: "512-555-0100", seats: 8, useCase: "Websites", confirm: true,
};

assert(!validateApplication(good).error, "a complete application from a registered business is accepted");
assert(validateApplication({ ...good, confirm: false }).error, "the applicant must confirm the business is registered");
assert(validateApplication({ ...good, regNumber: "" }).error, "a registration number or EIN is required");
assert(validateApplication({ ...good, entityType: "myself" }).error, "only real business types are accepted");
assert(validateApplication({ ...good, seats: 1 }).error, "an organization needs at least 2 seats");
assert(validateApplication({ ...good, workEmail: "nope" }).error, "a work email is required");

const q = quoteFor(8);
assert(q.monthly === 240, "8 seats: $30 a seat a month");
assert(quoteFor(8, 30).pricePerSeat === 21, "with the new-member offer: 30% off ($21 a seat)");
assert(quoteFor(10).pricePerSeat === 25 && quoteFor(24).pricePerSeat === 25 && quoteFor(25).pricePerSeat === 20 && quoteFor(5000).pricePerSeat === 20, "more seats cost less: $25 from 10, $20 from 25");
assert(q.credits.ai === 800 && q.credits.aiCode === 600 && q.credits.galaxy5 === 400 && q.credits.space5 === 200, "credits are 100/75/50/25 per seat");

assert(warningsFor(validateApplication(good).app).length === 0, "a company email matching the website raises no warnings");
assert(warningsFor({ ...good, workEmail: "sam@gmail.com" }).some((w) => /personal email/.test(w)), "a personal email is pointed out");
assert(warningsFor({ ...good, workEmail: "sam@other.com" }).some((w) => /doesn't match/.test(w)), "an email from another domain is pointed out");
