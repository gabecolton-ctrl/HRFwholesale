// Content for the seller "situation" and "city" pages.
// Keep it honest and specific: real options, including ones that aren't us.
// General information only; pages link sellers to professionals where it matters.

export type FAQ = { q: string; a: string };

export type Situation = {
  slug: string;
  title: string; // H1
  nav: string; // short label for links
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  howWeHelp: string[];
  options: { title: string; body: string }[];
  steps?: string[];
  faqs: FAQ[];
  note?: string; // a caution or "talk to a professional" note
};

export const SITUATIONS: Situation[] = [
  {
    slug: "inherited-house",
    nav: "Inherited a house",
    title: "Sell an inherited house without the stress",
    metaTitle: "Sell an Inherited House for Cash · Probate & Heirs",
    metaDescription:
      "Inherited a house you don't want to keep? Sell it as-is for cash, even during probate or with belongings still inside. No repairs, no clean-out, no agent fees.",
    intro: [
      "Inheriting a house often comes at the hardest time: you're grieving, the property may be full of a lifetime of belongings, and you may be splitting decisions with siblings who live in other states.",
      "Many families decide to sell rather than keep up the taxes, insurance, utilities and repairs on a house nobody plans to live in. We buy inherited houses as they are, so you don't have to clean it out, fix it up or manage showings.",
    ],
    howWeHelp: [
      "Leave anything you don't want. We handle the clean-out after closing.",
      "We can work with the executor or administrator while probate is open, and the title company confirms who needs to sign.",
      "Out-of-state heirs can usually sign closing documents remotely or by mail.",
      "One clear written offer everyone in the family can review.",
    ],
    options: [
      { title: "Keep it as a rental", body: "Can make sense if the house is in good shape and someone is ready to be a landlord. Budget for repairs, vacancies and management." },
      { title: "List it with an agent", body: "Often the highest price for a house that's updated and move-in ready, but it usually means repairs, cleaning, showings and a longer timeline." },
      { title: "Sell to a cash buyer", body: "Fastest and simplest when the house needs work, the family wants a clean break, or nobody can manage a listing." },
    ],
    steps: [
      "Find out whether there's a will and who the executor is.",
      "Talk with a probate attorney about what's needed before a sale. In Texas that can be probate, a small estate affidavit, or an affidavit of heirship, depending on the situation.",
      "Keep the house insured and secured while it's vacant.",
      "Get a no-obligation offer so the family knows its options.",
    ],
    faqs: [
      { q: "Can you buy the house before probate is finished?", a: "Often, yes. If an executor or administrator has been appointed, they can usually sign. Every estate is different, so the title company and your probate attorney confirm exactly who needs to sign before closing." },
      { q: "What if my siblings and I don't agree?", a: "Everyone on title generally has to agree to a sale. A written offer with the numbers spelled out often helps families make a decision together." },
      { q: "Do we have to empty the house first?", a: "No. Take what matters to you and leave the rest." },
    ],
    note: "This page is general information, not legal advice. A Texas probate attorney can tell you what your specific estate needs.",
  },
  {
    slug: "behind-on-property-taxes",
    nav: "Behind on property taxes",
    title: "Behind on property taxes? You have options",
    metaTitle: "Sell a House With Back Property Taxes · Cash Offer",
    metaDescription:
      "Owe back property taxes? Learn your options, and how a cash sale can pay off delinquent taxes at closing so you walk away clean.",
    intro: [
      "Falling behind on property taxes happens more than people think: after a job loss, a medical bill, a big reappraisal, or when a house is inherited and nobody's paying the bill.",
      "In Texas, penalties and interest start adding up after the January 31 deadline and keep growing through the year. If taxes stay unpaid, the county can eventually sue and sell the property. The sooner you act, the more options you have.",
    ],
    howWeHelp: [
      "Back taxes, penalties and interest can be paid off from the sale at closing.",
      "We buy as-is, even if the house needs major repairs.",
      "Close on your timeline, including quickly if a tax suit is already filed.",
    ],
    options: [
      { title: "Set up a payment plan", body: "Many county tax offices offer installment agreements. Call your county tax assessor-collector to ask what you qualify for." },
      { title: "Ask about a deferral", body: "If you're 65 or older, disabled, or a disabled veteran, Texas lets you defer taxes on your homestead in some cases. Your appraisal district or tax office can explain the rules." },
      { title: "Sell and pay it off at closing", body: "If keeping the house isn't realistic, selling stops the penalties from growing and lets you keep whatever equity is left." },
    ],
    faqs: [
      { q: "Can I sell a house that has a tax lien?", a: "Yes. The title company pays the taxes owed out of the sale proceeds at closing, and the lien is released." },
      { q: "Will you still buy it if the county has filed a lawsuit?", a: "Usually, yes. We'll need to move faster and coordinate with the title company and the attorney handling the suit." },
      { q: "What if I owe more than the house is worth?", a: "Tell us the numbers. We'll be honest about whether a sale makes sense or whether another option fits you better." },
    ],
    note: "General information only. Contact your county tax office for exact amounts and programs, and an attorney if a lawsuit has been filed.",
  },
  {
    slug: "avoid-foreclosure",
    nav: "Facing foreclosure",
    title: "Behind on payments or facing foreclosure",
    metaTitle: "Facing Foreclosure? Sell Your House Fast for Cash",
    metaDescription:
      "Behind on mortgage payments? See your options before a foreclosure sale, including selling for cash to protect your equity and your credit.",
    intro: [
      "Missing mortgage payments is stressful, and foreclosure in Texas can move quickly. Most Texas foreclosures don't go through court, and sales are held on the first Tuesday of the month after the required notices.",
      "You still have options until the sale happens. The important thing is to act early.",
    ],
    howWeHelp: [
      "A fast, as-is cash sale can pay off the loan before the foreclosure date.",
      "Selling first can protect your remaining equity, which you could otherwise lose at a foreclosure sale.",
      "We work directly with your lender and the title company to get the payoff right.",
    ],
    options: [
      { title: "Call your lender now", body: "Ask about a repayment plan, forbearance or a loan modification. Lenders often have more options before a sale is scheduled." },
      { title: "Talk to a free HUD-approved housing counselor", body: "They can review your situation and help you talk to your lender at no cost. Search 'HUD housing counselor' or call your local housing agency." },
      { title: "Sell before the sale date", body: "If keeping the house isn't realistic, a quick sale can pay off the loan and protect your credit better than a completed foreclosure." },
    ],
    faqs: [
      { q: "Is it too late if I already got a notice of sale?", a: "Not necessarily. Many sales are stopped when the loan is paid off before the sale date. Call us and your lender right away, and timing matters." },
      { q: "What if I owe more than the house is worth?", a: "A regular sale may not work, but a short sale (where the lender accepts less) might. We'll tell you honestly if that's the case." },
      { q: "Will you charge me any fees?", a: "No. We never charge sellers fees, and you should be wary of anyone who asks for money up front to 'save' your house." },
    ],
    note: "Watch out for foreclosure rescue scams: never pay upfront fees or sign your deed over to someone who promises to save your home. This page is not legal or financial advice.",
  },
  {
    slug: "tired-landlord",
    nav: "Tired landlord",
    title: "Done being a landlord? Sell your rental as-is",
    metaTitle: "Sell a Rental Property With Tenants · Cash Offer",
    metaDescription:
      "Tired of tenants, repairs and late rent? Sell your rental property as-is, with tenants in place, for cash. No repairs and no need to wait for a vacancy.",
    intro: [
      "Late rent, 2 a.m. repair calls, turnover costs and evictions add up. Many landlords reach a point where the rental isn't worth the headache anymore.",
      "We buy rental houses and small multifamily properties as they are, including with tenants still living there.",
    ],
    howWeHelp: [
      "Sell with tenants in place. Existing leases transfer to the new owner.",
      "No need to fix up the unit or wait for a vacancy.",
      "We can also talk about monthly payments instead of one lump sum if that works better for your taxes or income.",
    ],
    options: [
      { title: "Hire a property manager", body: "If you want to keep the investment but not the work, a manager typically costs a percentage of rent plus leasing fees." },
      { title: "List it", body: "Works best when the property is vacant and updated. Occupied rentals are harder to show." },
      { title: "Sell as-is to a cash buyer", body: "The simplest exit when the property needs work or has tenant issues." },
    ],
    faqs: [
      { q: "Do the tenants have to move out?", a: "No. We can buy with tenants in place. Their leases and deposits transfer at closing." },
      { q: "What about a tenant who isn't paying?", a: "Tell us the situation. We buy properties with difficult tenants regularly and factor it into the offer." },
      { q: "Can you pay me over time instead?", a: "Sometimes. Seller financing can spread out your income. Ask your CPA how it would affect your taxes." },
    ],
  },
  {
    slug: "divorce",
    nav: "Divorce or separation",
    title: "Selling a house during a divorce",
    metaTitle: "Sell Your House During a Divorce · Fast Cash Offer",
    metaDescription:
      "Need to sell the house as part of a divorce? A quick, as-is cash sale can make dividing the proceeds simpler. We work with both parties and attorneys.",
    intro: [
      "When a marriage ends, the house is often the biggest shared asset, and one of the hardest things to agree on.",
      "A quick, straightforward sale can let both people move on and split the proceeds without months of showings, repairs and negotiation.",
    ],
    howWeHelp: [
      "One clear offer both parties (and their attorneys) can review.",
      "No repairs or showings, so neither of you has to keep the house show-ready.",
      "Proceeds are divided at closing by the title company according to your agreement or court order.",
    ],
    options: [
      { title: "One spouse keeps the house", body: "Usually requires refinancing the loan into that person's name and buying out the other's share." },
      { title: "List it with an agent", body: "Can bring a higher price if both parties cooperate on repairs, pricing and showings." },
      { title: "Sell for cash", body: "Often the simplest when time, cooperation or repairs are an issue." },
    ],
    faqs: [
      { q: "Do we both have to sign?", a: "Usually everyone on the title must sign, and a court order may also apply. Your attorneys and the title company will confirm." },
      { q: "Can we close while the divorce is still in progress?", a: "Often yes, as long as both parties agree and nothing in the court's orders prevents it." },
    ],
    note: "General information only. Follow your attorney's advice and any court orders that apply to the property.",
  },
  {
    slug: "house-needs-repairs",
    nav: "House needs major repairs",
    title: "Sell a house that needs major repairs",
    metaTitle: "Sell a House That Needs Repairs · As-Is Cash Offer",
    metaDescription:
      "Foundation problems, roof damage, fire or water damage? Sell your house as-is for cash. No repairs, no inspections to pass, no contractors.",
    intro: [
      "Foundation movement, an old roof, outdated electrical, plumbing leaks, fire or water damage: big repairs can make a house hard to sell the traditional way, because many buyers' lenders won't finance a home that needs major work.",
      "We buy houses in any condition, so you don't have to spend money you may not have on repairs before selling.",
    ],
    howWeHelp: [
      "No repairs, no contractors, no inspections to pass.",
      "We factor repair costs into one clear offer and show you how we got there.",
      "Damaged, unlivable and vacant properties are fine.",
    ],
    options: [
      { title: "Fix it, then list it", body: "Can bring the highest price if you have the cash, time and a contractor you trust." },
      { title: "Use insurance", body: "If the damage came from a covered event like a storm or fire, check your claim first. We can still buy if the claim is open." },
      { title: "Sell as-is", body: "Best when repairs are expensive, uncertain or you simply want to be done." },
    ],
    faqs: [
      { q: "Do I need to disclose the problems?", a: "Yes, be honest about what you know. With a cash sale we'll also see the house ourselves, so nothing is a surprise." },
      { q: "What if the house isn't livable?", a: "That's fine. We buy fire-damaged, flooded, gutted and condemned properties." },
    ],
  },
  {
    slug: "vacant-house",
    nav: "Vacant house or code violations",
    title: "Sell a vacant house or one with code violations",
    metaTitle: "Sell a Vacant House or Property With Code Violations",
    metaDescription:
      "Own a vacant house that's costing you money, or facing city code violations? Sell it as-is for cash, including open violations and liens.",
    intro: [
      "A vacant house keeps costing money: taxes, insurance, utilities, yard work, and the risk of break-ins, squatters or vandalism. Cities can also issue code violations and fines that grow over time.",
      "We buy vacant houses and properties with open code cases as they are.",
    ],
    howWeHelp: [
      "We can buy with open code violations, and fines or city liens can be resolved at closing.",
      "No need to fix the yard, board up or clean out first.",
      "Out-of-town owners can usually close remotely.",
    ],
    options: [
      { title: "Fix the violations", body: "Contact the city's code compliance office about deadlines and what's needed to close the case." },
      { title: "Rent it out", body: "Possible if it's in livable shape and you're ready to manage tenants or a property manager." },
      { title: "Sell as-is", body: "Stops the ongoing costs and hands the code issues to someone ready to fix them." },
    ],
    faqs: [
      { q: "Will the city fines come out of my proceeds?", a: "Liens recorded against the property are usually paid at closing. We'll go over the numbers with you before you sign." },
      { q: "Is vacant-home insurance a problem?", a: "Many standard policies limit coverage after a home sits vacant for a while. Check your policy, because it's one more reason not to let a vacant house sit." },
    ],
  },
  {
    slug: "relocating",
    nav: "Relocating or moving fast",
    title: "Relocating? Sell your house on your schedule",
    metaTitle: "Relocating? Sell Your House Fast for Cash",
    metaDescription:
      "Moving for work or family? Sell your house quickly and close on your timeline, with no repairs, no showings and no waiting on a buyer's loan.",
    intro: [
      "A new job, a transfer, or family needs in another city can mean you need to move before your house would sell the usual way.",
      "We give you a firm cash offer and let you choose the closing date, so you can plan your move with certainty.",
    ],
    howWeHelp: [
      "Pick your closing date, fast or a few weeks out.",
      "Flexible move-out: stay a little longer after closing if you need to.",
      "Close remotely after you've moved.",
    ],
    options: [
      { title: "Ask about relocation benefits", body: "Some employers offer a relocation package or a home-sale program. Check with HR first." },
      { title: "List it", body: "Usually the highest price if you have time and can keep it show-ready from a distance." },
      { title: "Sell for cash", body: "Certainty and speed, with no carrying two house payments while you wait." },
    ],
    faqs: [
      { q: "Can I close after I've already moved?", a: "Yes. Closing documents can usually be signed remotely or with a mobile notary." },
      { q: "Can I leave furniture behind?", a: "Yes. Take what you want and leave the rest." },
    ],
  },
];

export type City = {
  slug: string;
  name: string;
  state: "TX";
  county: string;
  appraisal: string;
  areas: string[];
  metaDescription: string;
  intro: string[];
  local: string; // a city-specific paragraph
};

export const CITIES: City[] = [
  {
    slug: "dallas-tx",
    name: "Dallas",
    state: "TX",
    county: "Dallas County",
    appraisal: "Dallas Central Appraisal District",
    areas: ["Oak Cliff", "Pleasant Grove", "East Dallas", "West Dallas", "Lake Highlands", "Far North Dallas"],
    metaDescription: "Sell your Dallas house fast for cash. Any condition, any situation, from Oak Cliff to Lake Highlands. No repairs, no fees, close on your timeline.",
    intro: [
      "We're headquartered in the Dallas area and buy houses across the city, from older homes in Oak Cliff and Pleasant Grove to properties in East Dallas, West Dallas, Lake Highlands and Far North Dallas.",
      "Whether the house needs a new foundation, has tenants, was inherited or you just need to move quickly, we'll make you a clear, no-obligation cash offer.",
    ],
    local: "Most of Dallas sits in Dallas County, where property values are set by the Dallas Central Appraisal District. Rising appraisals have pushed property taxes up for many longtime owners, and that's one of the most common reasons Dallas sellers call us.",
  },
  {
    slug: "fort-worth-tx",
    name: "Fort Worth",
    state: "TX",
    county: "Tarrant County",
    appraisal: "Tarrant Appraisal District",
    areas: ["Northside", "Polytechnic", "Stop Six", "Riverside", "Wedgwood", "Ridglea"],
    metaDescription: "Sell your Fort Worth house fast for cash. Any condition, from the Northside to Wedgwood. No repairs, no agent fees, close when you're ready.",
    intro: [
      "We buy houses throughout Fort Worth, including the Northside, Polytechnic, Stop Six, Riverside, Wedgwood and Ridglea.",
      "Older pier-and-beam homes, houses needing roof or foundation work, rentals with tenants: we buy them as-is and let you choose the closing date.",
    ],
    local: "Most of Fort Worth is in Tarrant County, where the Tarrant Appraisal District sets values. Many of the city's older neighborhoods have homes built decades ago that need significant updates, which is exactly the kind of house we buy.",
  },
  {
    slug: "arlington-tx",
    name: "Arlington",
    state: "TX",
    county: "Tarrant County",
    appraisal: "Tarrant Appraisal District",
    areas: ["North Arlington", "East Arlington", "South Arlington", "Central Arlington near UT Arlington"],
    metaDescription: "Sell your Arlington, TX house fast for cash. As-is, any condition, rentals welcome. No repairs or fees, and you pick the closing date.",
    intro: [
      "We buy houses in every part of Arlington: North, East, South and Central Arlington near UT Arlington.",
      "Arlington has a lot of rental homes, and we regularly buy from landlords who are ready to sell, with or without tenants in place.",
    ],
    local: "Arlington is in Tarrant County, and property values are set by the Tarrant Appraisal District. If you own a rental near the university or an older home that needs work, we can make you an offer without any repairs or showings.",
  },
  {
    slug: "garland-tx",
    name: "Garland",
    state: "TX",
    county: "Dallas County",
    appraisal: "Dallas Central Appraisal District",
    areas: ["Downtown Garland", "Lake Ray Hubbard area", "Firewheel", "South Garland"],
    metaDescription: "Sell your Garland, TX house fast for cash. Any condition, any situation. No repairs, no agent fees, flexible closing.",
    intro: [
      "We buy houses across Garland, from downtown and South Garland to the Lake Ray Hubbard area and Firewheel.",
      "Many Garland homes were built decades ago and need updating. We buy them as they are, with no repairs, cleaning or showings.",
    ],
    local: "Most of Garland is in Dallas County, with values set by the Dallas Central Appraisal District. If you've inherited a Garland house, are behind on payments or just want a simple sale, we can help.",
  },
  {
    slug: "irving-tx",
    name: "Irving",
    state: "TX",
    county: "Dallas County",
    appraisal: "Dallas Central Appraisal District",
    areas: ["South Irving", "Central Irving", "Las Colinas", "Valley Ranch"],
    metaDescription: "Sell your Irving, TX house fast for cash. As-is, any condition, rentals and inherited homes welcome. No repairs or fees.",
    intro: [
      "We buy houses throughout Irving: South and Central Irving, Las Colinas and Valley Ranch.",
      "Whether it's an older home that needs work or a rental you're done managing, we'll make you a straightforward cash offer.",
    ],
    local: "Irving is in Dallas County, where the Dallas Central Appraisal District sets property values. Being close to DFW Airport and major job centers means many Irving owners relocate for work, and we can close on the schedule your move requires.",
  },
  {
    slug: "mesquite-tx",
    name: "Mesquite",
    state: "TX",
    county: "Dallas County",
    appraisal: "Dallas Central Appraisal District",
    areas: ["North Mesquite", "South Mesquite", "Town East area", "Downtown Mesquite"],
    metaDescription: "Sell your Mesquite, TX house fast for cash. Any condition, no repairs, no agent fees, close when you're ready.",
    intro: [
      "We buy houses all over Mesquite, North and South, around Town East and near downtown.",
      "Mesquite has many established neighborhoods of single-family homes. If yours needs work, has tenants, or you need a fast, simple sale, we're a good fit.",
    ],
    local: "Most of Mesquite is in Dallas County, with values set by the Dallas Central Appraisal District. We buy as-is, so there's no need to fix, clean or stage before you sell.",
  },
];

export const situationBySlug = (s: string) => SITUATIONS.find((x) => x.slug === s);
export const cityBySlug = (s: string) => CITIES.find((x) => x.slug === s);
