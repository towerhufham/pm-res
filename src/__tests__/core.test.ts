import { expect, it } from "vitest"
import { GameState } from "../core"
import type { CardDefinition, Decklist } from "../core"

// --------------- Helpers --------------- //

const emptyDecklist = (): Decklist => ({worlds: [], ex: [], main: []})
const emptyGame = () => new GameState([{worlds: [], ex: [], main: []}])
const nPlayerGame = (n: number) => new GameState(Array.from({length: n}, () => emptyDecklist()))

// --------------- Test Cards --------------- //

const bomb: CardDefinition = {
  identifier: "TEST-001",
  name: "Bomb",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [
    {
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      style: {type: "Activated"},
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
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "Field"}},
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
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "Field"}},
      targetingGroups: [],
      effects: [{type: "Send this to", to: "GY"}]
    }, {
      style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "GY"}},
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
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Hand"}],
      targetingGroups: [],
      effects: [{type: "Summon this"}]
    }, {
      style: {type: "Trigger", mandatory: false, trigger: {type: "This moves", to: "Field"}},
      targetingGroups: [],
      effects: [{type: "Send this to", to: "Hand"}]
    }
  ]
}

const boardwipe: CardDefinition = {
  identifier: "TEST-005",
  name: "Boardwipe",
  colors: [],
  cardType: "Vision",
  ex: false,
  abilities: [{
    style: {type: "Activated"},
    conditions: [{type: "In zone", zone: "Hand"}],
    targetingGroups: [],
    effects: [{type: "Send all to GY"}, {type: "Send this to", to: "GY"}]
  }]
}

const basketball: CardDefinition = {
  identifier: "TEST-006",
  name: "Overinflated Basketball",
  colors: ["Orange"],
  cardType: "Esper",
  ex: false,
  abilities: [{
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

const reviver: CardDefinition = {
  identifier: "TEST-007",
  name: "Reviver",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [{
    style: {type: "Trigger", mandatory: true, trigger: {type: "This moves", to: "GY"}},
    targetingGroups: [],
    effects: [{type: "Send this to", to: "Field"}]
  }]
}

const revivish: CardDefinition = {
  identifier: "TEST-007",
  name: "Revivish",
  colors: [],
  cardType: "Esper",
  ex: false,
  abilities: [{
    style: {type: "Trigger", mandatory: false, trigger: {type: "This moves", to: "GY"}},
    targetingGroups: [],
    effects: [{type: "Send this to", to: "Field"}]
  }]
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
  game.startActivation({player: 0, card, ability: card.abilities[0]!, targets: {}})
  game.chain?.playerPasses()
  expect(card.zone).toBe("Field")
  expect(game.chain?.state).toBe("Completed")
})

it("handles multi-step abilities", () => {
  const game = emptyGame()
  const card = game.spawnCard(0, basketball)
  game.moveCard(card, "Hand")
  game.startActivation({player: 0, card, ability: card.abilities[0]!, targets: {}})
  game.chain?.playerPasses()
  expect(card.zone).toBe("GY")
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
  game.startActivation({player: 0, card, ability: card.abilities[0]!, targets: {}})
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
  game.startActivation({player: 0, card, ability: card.abilities[0]!, targets: {}})
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
  game.startActivation({player: 0, card, ability: card.abilities[0]!, targets: {}})
  expect(game.chain?.state).toBe("Building")
  expect(game.chain?.inOriginalChain).toBe(true)
  expect(card.zone).toBe("Hand")
  game.chain?.playerPasses()
  //optional triggers require a batch
  expect(game.chain?.state).toBe("Ordering triggers")
  expect(game.chain?.pendingTriggerPool.length).toBe(1)
  game.chain?.playerBatchTriggers(0, game.chain?.pendingTriggerPool.map(ac => ({...ac, targets: {}}))) //shortcut (all are by the player)
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
  game.startActivation({player: 0, card, ability: card.abilities[0]!, targets: {}})
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

it("can handle multiple player boards", () => {
  const game = nPlayerGame(2)
  const esper0 = game.spawnCard(0, bomb)
  game.moveCard(esper0, "Field")
  const esper1 = game.spawnCard(1, bomb)
  game.moveCard(esper1, "Field")
  expect(game.cardsInZone(0, "Field").length).toBe(1)
  expect(game.cardsInZone(1, "Field").length).toBe(1)
})

it("can handle multiplayer effects", () => {
  const game = nPlayerGame(2)
  const esper0 = game.spawnCard(0, bomb)
  game.moveCard(esper0, "Field")
  const esper1 = game.spawnCard(1, bomb)
  game.moveCard(esper1, "Field")
  const wipe = game.spawnCard(0, boardwipe)
  game.moveCard(wipe, "Hand")
  game.startActivation({player: 0, card: wipe, ability: wipe.abilities[0]!, targets: {}})
  //need to pass once per player
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.chain?.state).toBe("Completed")
  //results
  expect(game.cardsInZone(0, "GY").length).toBe(2) //both bomb and the wipe
  expect(game.cardsInZone(1, "GY").length).toBe(1) //just the bomb
  expect(game.cardsInZone(0, "Field").length).toBe(0)
  expect(game.cardsInZone(1, "Field").length).toBe(0)
})

it("can handle one mandatory trigger per player without waiting", () => {
  const game = nPlayerGame(2)
  const esper0 = game.spawnCard(0, reviver)
  game.moveCard(esper0, "Field")
  const esper1 = game.spawnCard(1, reviver)
  game.moveCard(esper1, "Field")
  const wipe = game.spawnCard(0, boardwipe)
  game.moveCard(wipe, "Hand")
  game.startActivation({player: 0, card: wipe, ability: wipe.abilities[0]!, targets: {}})
  //need to pass once per player
  expect(game.chain?.inOriginalChain).toBe(true)
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  //now on the next chain
  expect(game.chain?.inOriginalChain).toBe(false)
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  //results
  expect(game.chain?.state).toBe("Completed")
  expect(game.cardsInZone(0, "Field").length).toBe(1)
  expect(game.cardsInZone(0, "GY").length).toBe(1)
  expect(game.cardsInZone(1, "Field").length).toBe(1)
  expect(game.cardsInZone(1, "GY").length).toBe(0)
})

it("can take an order for multiple mandatory triggers for one player", () => {
  const game = emptyGame()
  const card0 = game.spawnCard(0, reviver)
  game.moveCard(card0, "Field")
  const card1 = game.spawnCard(0, reviver)
  game.moveCard(card1, "Field")
  const card2 = game.spawnCard(0, reviver)
  game.moveCard(card2, "Field")
  const wipe = game.spawnCard(0, boardwipe)
  game.moveCard(wipe, "Hand")
  game.startActivation({player: 0, card: wipe, ability: wipe.abilities[0]!, targets: {}})
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.cardsInZone(0, "Field").length).toBe(0)
  expect(game.cardsInZone(0, "GY").length).toBe(4)
  expect(game.chain?.state).toBe("Ordering triggers")
  expect(game.chain?.pendingTriggerPool.length).toBe(3)
  const accepted = game.chain?.pendingTriggerPool.map(ac => ({...ac, targets: {}}))! //shortcut
  game.chain?.playerBatchTriggers(0, accepted)
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.chain?.state).toBe("Completed")
  expect(game.cardsInZone(0, "Field").length).toBe(3)
  expect(game.cardsInZone(0, "GY").length).toBe(1)
})

it("can take an ordered subset for multiple optional triggers for one player", () => {
  const game = emptyGame()
  const card0 = game.spawnCard(0, revivish)
  game.moveCard(card0, "Field")
  const card1 = game.spawnCard(0, revivish)
  game.moveCard(card1, "Field")
  const card2 = game.spawnCard(0, revivish)
  game.moveCard(card2, "Field")
  const wipe = game.spawnCard(0, boardwipe)
  game.moveCard(wipe, "Hand")
  game.startActivation({player: 0, card: wipe, ability: wipe.abilities[0]!, targets: {}})
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.cardsInZone(0, "Field").length).toBe(0)
  expect(game.cardsInZone(0, "GY").length).toBe(4)
  expect(game.chain?.state).toBe("Ordering triggers")
  expect(game.chain?.pendingTriggerPool.length).toBe(3)
  const pool = game.chain?.pendingTriggerPool.map(ac => ({...ac, targets: {}}))! //shortcut
  const accepted = [pool[0]!, pool[2]!]
  game.chain?.playerBatchTriggers(0, accepted)
  expect(game.chain?.state).toBe("Building")
  game.chain?.playerPasses()
  expect(game.chain?.state).toBe("Completed")
  expect(game.cardsInZone(0, "Field").length).toBe(2)
  expect(game.cardsInZone(0, "GY").length).toBe(2)
})