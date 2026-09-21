import { expect, it } from "vitest"
import { GameState } from "../core"
import type { CardDefinition } from "../core"

// --------------- Helpers --------------- //

const emptyGame = () => new GameState([{worlds: [], ex: [], main: []}])

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