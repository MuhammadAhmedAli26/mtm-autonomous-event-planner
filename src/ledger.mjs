/**
 * Ledger Module
 * Stores claims with provenance, resolves newest-wins supersession,
 * validates sender standing, and tracks message lifecycle.
 * Strictly adheres to Part 6 of the official build prompt.
 */

export function normalizeText(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeSlotKey(claim) {
  switch (claim.k) {
    case "param":
      return `param:${claim.name}`;
    case "cost":
      return `cost:${normalizeText(claim.label)}`;
    case "venue":
      return `venue:${normalizeText(claim.name)}`;
    case "food":
      return `food:${normalizeText(claim.item)}`;
    case "judging":
      return `judging:${claim.name}`;
    case "rule":
      return `rule:${claim.type}:${normalizeText(claim.label || claim.feature || claim.who || claim.item || "default")}`;
    case "extra":
      return `extra:${normalizeText(claim.label)}`;
    case "commit":
      return `commit:${claim.what}:${normalizeText(claim.item || claim.name || "default")}`;
    case "availability":
      return `availability:${normalizeText(claim.who)}`;
    case "note":
      return `note:${claim.area}:${normalizeText(claim.text?.slice(0, 15))}`;
    default:
      return `other:${claim.k}:${normalizeText(JSON.stringify(claim))}`;
  }
}

export class Ledger {
  constructor() {
    this.messages = []; // All messages ingested
    this.slots = new Map(); // slotKey -> { claim, messageId, date, position }
    this.supersededClaims = [];
  }

  static clone(original) {
    const copy = new Ledger();
    copy.messages = JSON.parse(JSON.stringify(original.messages));
    copy.slots = new Map(JSON.parse(JSON.stringify(Array.from(original.slots.entries()))));
    copy.supersededClaims = JSON.parse(JSON.stringify(original.supersededClaims));
    return copy;
  }

  checkStanding(msg, claim) {
    const role = (msg.role || "other").toLowerCase();
    const HARD_PARAMS = new Set([
      "param:budget_cap",
      "param:students",
      "param:teams",
      "param:team_size",
      "param:duration_min",
      "param:staff",
      "rule:block",
      "rule:headcount",
    ]);

    const slotKey = computeSlotKey(claim);
    if ((role === "participant" || role === "supplier") && HARD_PARAMS.has(slotKey)) {
      return { allowed: false, reason: `no standing: ${role} cannot change ${slotKey}` };
    }
    return { allowed: true };
  }

  addMessage(msg, position = 0) {
    this.messages.push(msg);
    const msgId = msg.id || this.messages.length;

    if (msg.status === "irrelevant") {
      msg.finalStatus = "IGNORED";
      return;
    }
    if (msg.status === "request") {
      msg.finalStatus = "NOT APPROVED";
      return;
    }

    let keptAnyClaim = false;

    for (const claim of msg.claims || []) {
      const standing = this.checkStanding(msg, claim);
      if (!standing.allowed) {
        msg.finalStatus = "REJECTED";
        msg.rejectionReason = standing.reason;
        return;
      }

      const slotKey = computeSlotKey(claim);
      const existing = this.slots.get(slotKey);

      if (!existing) {
        this.slots.set(slotKey, {
          claim,
          messageId: msgId,
          date: msg.date || null,
          position,
        });
        keptAnyClaim = true;
      } else {
        // Newest wins resolution
        let isNewer = false;
        if (msg.date && existing.date) {
          isNewer = new Date(msg.date).getTime() >= new Date(existing.date).getTime();
        } else {
          // If no date, later position wins
          isNewer = position >= existing.position;
        }

        if (isNewer) {
          this.supersededClaims.push({
            slotKey,
            oldClaim: existing.claim,
            supersededByMessageId: msgId,
          });
          this.slots.set(slotKey, {
            claim,
            messageId: msgId,
            date: msg.date || null,
            position,
          });
          keptAnyClaim = true;
        } else {
          this.supersededClaims.push({
            slotKey,
            oldClaim: claim,
            supersededByMessageId: existing.messageId,
          });
        }
      }
    }

    if (keptAnyClaim) {
      msg.finalStatus = "USED";
    } else {
      msg.finalStatus = "SUPERSEDED";
    }
  }

  getActiveClaims() {
    return Array.from(this.slots.values()).map((s) => ({
      ...s.claim,
      _provenance: s.messageId,
    }));
  }

  getKnownLabels() {
    const labels = [];
    for (const s of this.slots.values()) {
      if (s.claim.label) labels.push(s.claim.label);
      if (s.claim.name) labels.push(s.claim.name);
      if (s.claim.item) labels.push(s.claim.item);
    }
    return Array.from(new Set(labels));
  }
}
