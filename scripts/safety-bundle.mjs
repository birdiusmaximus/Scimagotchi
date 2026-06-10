// src/services/ai/safetyClassifier.ts
var RULES = [
  {
    level: 4,
    category: "medical_emergency",
    phrases: [
      "stopped breathing",
      "not breathing",
      "can't breathe",
      "cant breathe",
      "taken pills",
      "took pills",
      "overdose",
      "overdosed",
      "od on",
      "bleeding out",
      "unconscious"
    ]
  },
  {
    level: 4,
    category: "imminent_self_harm",
    phrases: [
      "kill myself tonight",
      "kill myself now",
      "end it tonight",
      "end it all tonight",
      "about to jump",
      "going to jump",
      "i have a plan to",
      "pills now",
      "goodbye forever",
      "this is the end"
    ]
  },
  {
    level: 4,
    category: "violence_to_others",
    phrases: [
      "going to hurt someone",
      "going to hurt him",
      "going to hurt her",
      "going to hurt them",
      "going to kill him",
      "going to kill her",
      "going to kill them",
      "want to hurt someone"
    ]
  },
  {
    level: 3,
    category: "suicidal_ideation",
    phrases: [
      "kill myself",
      "killing myself",
      "suicidal",
      "suicide",
      "want to die",
      "wish i was dead",
      "wish i were dead",
      "better off dead",
      "end my life",
      "don't want to be here anymore",
      "dont want to be here anymore",
      "no reason to live",
      "can't keep myself safe",
      "cant keep myself safe",
      "can't keep myself alive"
    ]
  },
  {
    level: 3,
    category: "self_harm",
    phrases: [
      "hurt myself",
      "harm myself",
      "self harm",
      "self-harm",
      "cut myself",
      "cutting myself",
      "burn myself",
      "hurting myself"
    ]
  },
  {
    level: 3,
    category: "abuse_danger",
    phrases: ["hitting me", "hits me", "not safe at home", "threatening me", "hurting me"]
  }
];
function classifySafety(text) {
  const t = ` ${text.toLowerCase()} `;
  for (const level of [4, 3]) {
    for (const rule of RULES) {
      if (rule.level !== level) continue;
      for (const phrase of rule.phrases) {
        if (t.includes(phrase)) {
          return { level, category: rule.category, matched: phrase };
        }
      }
    }
  }
  return { level: 0, category: "none", matched: null };
}
export {
  classifySafety
};
