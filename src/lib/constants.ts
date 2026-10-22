export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Follow up",
  "Appointment set",
  "Offer made",
  "Under contract",
  "Closed",
  "Dead",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Statuses a VA/caller is allowed to set (the database enforces this too).
export const VA_STATUSES: LeadStatus[] = ["New", "Contacted", "Follow up", "Appointment set", "Dead"];

export const LEAD_SOURCES = [
  "Website",
  "Tax delinquent",
  "Probate / inherited",
  "Driving for dollars",
  "Handwritten letters",
  "FSBO / Marketplace",
  "Skip trace + text/dialer",
  "Direct mail",
  "PropStream",
  "Referral",
  "JV partner",
  "Other",
] as const;

export const CONDITIONS = [
  "Move-in ready",
  "Needs minor repairs",
  "Needs major repairs",
  "Needs a full renovation",
  "Not livable / damaged",
] as const;

export const TIMELINES = ["As soon as possible", "Within 30 days", "1–3 months", "3–6 months", "Just exploring"] as const;

export const SELL_REASONS = [
  "Inherited property",
  "Behind on payments / taxes",
  "Tired landlord / bad tenants",
  "Relocating",
  "Divorce or separation",
  "Too many repairs",
  "Downsizing",
  "Other",
] as const;

export const PROPERTY_TYPES = ["Single family", "Duplex", "Triplex/Fourplex", "Multifamily 5+", "Townhome", "Condo", "Mobile home", "Land"] as const;
export const REHAB_LEVELS = ["Turnkey", "Light", "Medium", "Heavy"] as const;
export const STRATEGIES = ["Flip", "Hold"] as const;

export const ACTIVITY_KINDS = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "voicemail", label: "Voicemail" },
  { value: "door", label: "Door knock" },
  { value: "letter", label: "Letter" },
  { value: "appointment", label: "Walkthrough" },
  { value: "note", label: "Note" },
] as const;

export const DEAL_STATUSES = ["Under contract", "Marketing", "Buyer assigned", "Clear to close", "Closed", "Cancelled"] as const;
export const EXIT_STRATEGIES = ["Assignment", "Double close", "Keep"] as const;

export const CADENCE_DAYS = [3, 7, 14, 30, 60, 90];

export type AppRole = "pending" | "owner" | "acquisitions" | "dispositions" | "va" | "buyer";
export const STAFF_ROLES: AppRole[] = ["owner", "acquisitions", "dispositions", "va"];
export const ROLE_LABELS: Record<AppRole, string> = {
  pending: "No access yet",
  owner: "Owner",
  acquisitions: "Acquisitions rep",
  dispositions: "Dispositions",
  va: "VA / caller",
  buyer: "Buyer",
};

// What each staff role can open in the CRM (the database enforces the data rules).
export const NAV_BY_ROLE: Record<AppRole, string[]> = {
  owner: ["dashboard", "follow-ups", "leads", "analyzer", "buyers", "pipeline", "import", "export", "team", "settings"],
  acquisitions: ["follow-ups", "leads", "analyzer", "pipeline"],
  dispositions: ["buyers", "pipeline"],
  va: ["follow-ups", "leads"],
  buyer: [],
  pending: [],
};
