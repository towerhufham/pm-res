import type { CardDefinition } from "./core";

// --------------- Test Cards --------------- //

export const bomb: CardDefinition = {
  identifier: "TEST-001",
  name: "Bomb",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      text: "Summon this from your hand.",
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      text: "Send target card from the field to the GY.",
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Field"}],
      targetingGroups: [{type: "Single Target", criteria: [{type: "In Zone", zone: "Field"}], tag: ""}],
      effects: [{type: "Send targets to", to: "GY", tag: ""}]
    }
  ]
}

export const springy: CardDefinition = {
  identifier: "TEST-002",
  name: "Springy",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      text: "Summon this from your hand.",
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      text: "When this is summoned, return it to your hand.",
      style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "Field"}},
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Hand"}]
    }
  ]
}

export const roundabout: CardDefinition = {
  identifier: "TEST-003",
  name: "Roundabout",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      text: "Summon this from your hand.",
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      text: "When this is summoned, send it to the GY.",
      style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "Field"}},
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }, {
      text: "When this is sent to the GY, return it to your hand.",
      style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "GY"}},
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Hand"}]
    }
  ]
}

export const springish: CardDefinition = {
  identifier: "TEST-004",
  name: "Springish",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      text: "Summon this from your hand.",
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      text: "When this is summoned, you may return it to your hand.",
      style: {type: "Trigger", mandatory: false, trigger: {type: "This moves", to: "Field"}},
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Hand"}]
    }
  ]
}

export const boardwipe: CardDefinition = {
  identifier: "TEST-005",
  name: "Boardwipe",
  colors: [],
  cardType: "Vision",
  ex: false,
  abilities: [{
    text: "Discard this and send all cards on the field to the GY.",
    style: {type: "Activated"},
    conditions: [{type: "In zone", zone: "Hand"}],
    targetingGroups: [],
    effects: [{type: "Send all to GY"}, {type: "Send this to", to: "GY"}]
  }]
}

export const basketball: CardDefinition = {
  identifier: "TEST-006",
  name: "Overinflated Basketball",
  colors: ["Orange"],
  cardType: "Esper",
  ex: false,
  abilities: [{
    text: "Summon this from your hand. Then return it to your hand. Then summon it. Then return it to your hand. Then send it to the GY.",
    style: {type: "Activated"},
    conditions: [{type: "In zone", zone: "Hand"}],
    targetingGroups: [],
    effects: [
      {type: "Summon this"}, 
      {type: "Send this to", to: "Hand"},
      {type: "Summon this"},
      {type: "Send this to", to: "Hand"},
      {type: "Send this to", to: "GY"}
    ]
  }]
}

export const reviver: CardDefinition = {
  identifier: "TEST-007",
  name: "Reviver",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [{
    text: "When this is sent to the GY, summon it.",
    style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "GY"}},
    targetingGroups: [],
    effects: [{type: "Send this to", to: "Field"}]
  }]
}

export const revivish: CardDefinition = {
  identifier: "TEST-008",
  name: "Revivish",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [{
    text: "When this is sent to the GY, you may summon it.",
    style: {type: "Trigger", mandatory: false, trigger: {type: "This moves", to: "GY"}},
    targetingGroups: [],
    effects: [{type: "Send this to", to: "Field"}]
  }]
}