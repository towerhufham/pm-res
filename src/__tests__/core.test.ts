import { expect, it } from "vitest"
import { GameState } from "../core"
import type { CardDefinition } from "../core"

// --------------- Helpers --------------- //

const emptyGame = () => new GameState([{worlds: [], ex: [], main: []}])

// --------------- Test Cards --------------- //

const bomb: CardDefinition = {
  identifier: "TEST-001",
  name: "Bomb",
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

const springy: CardDefinition = {
  identifier: "TEST-002",
  name: "Springy",
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
      effects: [{type: "Send this to", to: "Hand"}]
    }
  ]
}

const roundabout: CardDefinition = {
  identifier: "TEST-003",
  name: "Roundabout",
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
      trigger: {type: "This moves", to: "GY"},
      mandatory: true,
      reactor: false,
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Hand"}]
    }
  ]
}

const springish: CardDefinition = {
  identifier: "TEST-004",
  name: "Springy",
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
      effects: [{type: "Send this to", to: "Hand"}]
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
  const card = game.spawnCard(0, bomb)
  expect(game.cards.length).toBe(1)
  expect(card.zone).toBe("Deck")
})

it("moves cards", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bomb)
  game.moveCard(card, "Field")
  expect(card.zone).toBe("Field")
  expect(game.cardsInZone(0, "Field").length).toBe(1)
})

it("finds activatable abilities", () => {
  const game = emptyGame()
  expect(game.getAllActivatableAbilities(0).length).toBe(0)
  const card = game.spawnCard(0, bomb)
  game.moveCard(card, "Hand")
  expect(game.getAllActivatableAbilities(0).length).toBe(1)
})

it("activates and applies abilities", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bomb)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  game.chain?.playerPasses()
  expect(card.zone).toBe("Field")
  expect(game.chain?.state).toBe("Completed")
})

it("can take targets with abilities", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, bomb)
  game.moveCard(card, "Field")
  game.startActivation({player: 0, card, ability: card.abilities[1]!, targets: {"": [card]}})
  game.chain?.playerPasses()
  expect(card.zone).toBe("GY")
  expect(game.chain?.state).toBe("Completed")
})

it("handles mandatory triggers", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, springy)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(true)
  expect(card.zone).toBe("Hand")
  game.chain?.playerPasses()
  //auto-order the trigger, opening a new response window
  expect(game.chain?.pendingTriggerPool.length).toBe(0)
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(false)
  expect(card.zone).toBe("Field")
  game.chain?.playerPasses()
  //should be resolved now
  expect(card.zone).toBe("Hand")
  expect(game.chain?.state).toBe("Completed")
})

it("handles successive triggers", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, roundabout)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(true)
  expect(card.zone).toBe("Hand")
  game.chain?.playerPasses()
  //auto-order the first trigger, opening a new response window
  expect(game.chain?.pendingTriggerPool.length).toBe(0)
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(false)
  expect(card.zone).toBe("Field")
  game.chain?.playerPasses()
  //auto-order the second trigger, opening another new response window
  expect(game.chain?.pendingTriggerPool.length).toBe(0)
  expect(game.chain?.state).toBe("Building")
  expect(card.zone).toBe("GY")
  expect(game.chain?.inOriginalChain).toBe(false)
  game.chain?.playerPasses()
  //should be resolved now
  expect(card.zone).toBe("Hand")
  expect(game.chain?.state).toBe("Completed")
})

it("can accept optional triggers", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, springish)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(true)
  expect(card.zone).toBe("Hand")
  game.chain?.playerPasses()
  //optional triggers require a batch
  expect(game.chain?.state).toBe("Ordering triggers")
  expect(game.chain?.pendingTriggerPool.length).toBe(1)
  game.chain?.playerBatchTriggers(0, game.chain?.pendingTriggerPool) //shortcut (all are by the player)
  //open response window
  expect(game.chain?.pendingTriggerPool.length).toBe(0)
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(false)
  expect(card.zone).toBe("Field")
  game.chain?.playerPasses()
  //should be resolved now
  expect(card.zone).toBe("Hand")
  expect(game.chain?.state).toBe("Completed")
})

it("can reject optional triggers", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, springish)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!})
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(true)
  expect(card.zone).toBe("Hand")
  game.chain?.playerPasses()
  //optional triggers require a batch
  expect(game.chain?.state).toBe("Ordering triggers")
  expect(game.chain?.pendingTriggerPool.length).toBe(1)
  game.chain?.playerBatchTriggers(0, []) //send none
  //open response window (todo: should this happen? prolly not)
  expect(game.chain?.pendingTriggerPool.length).toBe(0)
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(false)
  expect(card.zone).toBe("Field")
  game.chain?.playerPasses()
  //should be resolved now
  expect(card.zone).toBe("Field")
  expect(game.chain?.state).toBe("Completed")
})