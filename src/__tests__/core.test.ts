import { expect, it } from "vitest"
import { GameState } from "../core"
import type { CardDefinition } from "../core"

// --------------- Helpers --------------- //

const emptyGame = () => new GameState([{worlds: [], ex: [], main: []}])
const nPlayerGame = (n: number) => new GameState(Array.from({length: n}, () => ({worlds: [], ex: [], main: []})))

// --------------- Test Cards --------------- //

const bouncer: CardDefinition = {
  identifier: "TEST-001",
  name: "Bouncer",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Field"}],
      targetingGroups: [{type: "Single Target", criteria: [{type: "In Zone", zone: "Field"}], tag: ""}],
      effects: [{type: "Send targets to", to: "GY", tag: ""}]
    }
  ]
}

const autobouncer: CardDefinition = {
  identifier: "TEST-002",
  name: "Auto-Bouncer",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      // targetingGroups: [{type: "Single Target", criteria: [{type: "In Zone", zone: "Field"}], tag: ""}],
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }
  ]
}

const optionalMover: CardDefinition = {
  identifier: "TEST-003",
  name: "Optional Mover",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: false,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }
  ]
}

const targetedReactor: CardDefinition = {
  identifier: "TEST-004",
  name: "Targeted Reactor",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [{type: "Single Target", criteria: [{type: "In Zone", zone: "Field"}], tag: ""}],
      effects: [{type: "Send targets to", to: "GY", tag: ""}]
    }
  ]
}

//has two mandatory triggers off the same move, so its controller has to choose their order
const doubleTrigger: CardDefinition = {
  identifier: "TEST-005",
  name: "Double Trigger",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Suspense"}]
    }
  ]
}

const fieldEntryTrigger: CardDefinition = {
  identifier: "TEST-006",
  name: "Field Entry Trigger",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Sacrifice this"}]
    }
  ]
}

const multiMover: CardDefinition = {
  identifier: "TEST-007",
  name: "Multi Mover",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      targetingGroups: [{type: "Multi Target", criteria: [{type: "In Zone", zone: "Hand"}], tag: "t"}],
      effects: [{type: "Send targets to", to: "Field", tag: "t"}]
    }
  ]
}

//two mandatory triggers off the same move, same as doubleTrigger, but with no "Activated"
//ability - meant to be moved onto the field by something else (like multiMover) instead of
//activated directly, so it can be given to a non-active player too
const doubleFieldTrigger: CardDefinition = {
  identifier: "TEST-008",
  name: "Double Field Trigger",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Suspense"}]
    }
  ]
}

//two mandatory triggers off the same move - one only fires if the card is still on the field
//when it resolves, the other unconditionally moves it away
const conditionalReactor: CardDefinition = {
  identifier: "TEST-009",
  name: "Conditional Reactor",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      conditions: [{type: "In zone", zone: "Field"}],
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }, {
      trigger: {type: "This moves", to: "Field"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Suspense"}]
    }
  ]
}

// --------------- Hit it, boys! --------------- //

it("starts with no cards", () => {
  const game = emptyGame()
  expect(game.cards.length).toBe(0)
})

it("spawns cards", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bouncer)
  expect(game.cards.length).toBe(1)
  expect(card.zone).toBe("Deck")
})

it("moves cards", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bouncer)
  game.moveCard(card, "Field")
  expect(card.zone).toBe("Field")
  expect(game.cardsInZone(0, "Field").length).toBe(1)
})

it("finds activatable abilities", () => {
  const game = emptyGame()
  expect(game.getAllActivatableAbilities(0).length).toBe(0)
  const card = game.spawnCard(0, bouncer)
  game.moveCard(card, "Hand")
  expect(game.getAllActivatableAbilities(0).length).toBe(1)
})

it("activates and applies abilities", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bouncer)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(card.zone).toBe("Field")
  expect(game.waitingOn.type).toBe("Main")
})

it("waits for targets and supplies them", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bouncer)
  game.moveCard(card, "Field")
  game.startActivation({player: 0, card, ability: card.abilities[1]!})
  expect(game.waitingOn.type).toBe("Targeting")
  game.supplyTargets({"": [card]})
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("GY")
})

// --------------- Triggers --------------- //

it("automatically applies mandatory triggers", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, autobouncer)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("GY")
})

it("lets a player decline an optional trigger", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, optionalMover)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.waitingOn.type).toBe("Optional trigger")
  game.supplyOptionalTriggerChoice(false)
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("Field")
})

it("lets a player accept an optional trigger", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, optionalMover)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.waitingOn.type).toBe("Optional trigger")
  game.supplyOptionalTriggerChoice(true)
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("GY")
})

it("waits for targets before resolving a triggered ability", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, targetedReactor)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.waitingOn.type).toBe("Targeting")
  if (game.waitingOn.type !== "Targeting") throw new Error("unreachable")
  expect(game.waitingOn.ac.ability).toBe(card.abilities[1])
  game.supplyTargets({"": [card]})
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("GY")
})

it("makes a player order their own simultaneous triggers", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, doubleTrigger)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.waitingOn.type).toBe("Ordering triggers")
  if (game.waitingOn.type !== "Ordering triggers") throw new Error("unreachable")
  const [toGY, toSuspense] = game.waitingOn.toOrder
  //resolving the GY trigger last should be what sticks
  game.supplyTriggerOrder([toSuspense!, toGY!])
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("GY")
})

it("resolves order for a chosen ordering the other way too", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, doubleTrigger)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  if (game.waitingOn.type !== "Ordering triggers") throw new Error("unreachable")
  const [toGY, toSuspense] = game.waitingOn.toOrder
  game.supplyTriggerOrder([toGY!, toSuspense!])
  expect(card.zone).toBe("Suspense")
})

it("computes priority order starting from a given player", () => {
  const game = nPlayerGame(3)
  expect(game.priorityOrderFrom(0)).toEqual([0, 1, 2])
  expect(game.priorityOrderFrom(2)).toEqual([2, 0, 1])
})

it("auto-places simultaneous triggers from different players without pausing", () => {
  const game = nPlayerGame(2)
  const mine = game.spawnCard(0, fieldEntryTrigger)
  const theirs = game.spawnCard(1, fieldEntryTrigger)
  game.moveCard(mine, "Hand")
  game.moveCard(theirs, "Hand")
  const mover = game.spawnCard(0, multiMover)
  game.startActivation({player: 0, card: mover, ability: mover.abilities[0]!})
  expect(game.waitingOn.type).toBe("Targeting")
  game.supplyTargets({t: [mine, theirs]})
  //each player only has one trigger, so there's nothing to order - it should resolve straight through
  expect(game.waitingOn.type).toBe("Main")
  expect(mine.zone).toBe("GY")
  expect(theirs.zone).toBe("GY")
})

it("asks the active player to order their own triggers before other players", () => {
  const game = nPlayerGame(2)
  const mine = game.spawnCard(0, doubleFieldTrigger)
  const theirs = game.spawnCard(1, doubleFieldTrigger)
  game.moveCard(mine, "Hand")
  game.moveCard(theirs, "Hand")
  const mover = game.spawnCard(0, multiMover)
  game.startActivation({player: 0, card: mover, ability: mover.abilities[0]!})
  game.supplyTargets({t: [mine, theirs]})
  expect(game.waitingOn.type).toBe("Ordering triggers")
  if (game.waitingOn.type !== "Ordering triggers") throw new Error("unreachable")
  //player 0 is active and has 2 triggers of their own to order - they get asked first,
  //even though player 1's triggers end up resolving first once everything's placed
  expect(game.waitingOn.toOrder.every(ac => ac.player === 0)).toBe(true)
})

it("rechecks a mandatory trigger's conditions at resolution and fizzles if they no longer hold", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, conditionalReactor)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.waitingOn.type).toBe("Ordering triggers")
  if (game.waitingOn.type !== "Ordering triggers") throw new Error("unreachable")
  const [toGYIfStillOnField, toSuspenseUnconditional] = game.waitingOn.toOrder
  //resolve the unconditional Suspense trigger first, moving the card away before the
  //conditional GY trigger gets its turn - its "in zone: Field" condition should then fail
  game.supplyTriggerOrder([toSuspenseUnconditional!, toGYIfStillOnField!])
  expect(game.waitingOn.type).toBe("Main")
  expect(card.zone).toBe("Suspense")
})