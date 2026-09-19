import { shuffle } from "./util"

type LogEntry = { type: "Effects", effectAtom: EffectAtom[] }
  | { type: "Activation", card: Card, ability: Ability }
  | { type: "Trigger", card: Card, ability: Ability }
  | { type: "End Turn" }

class GameState {
  players: BoardState[]
  log: LogEntry[]
  round: number
  turnPlayer: number
  priorityPlayer: number
  nextId: number

  constructor(decklists: Decklist[]) {
    this.players = []
    this.log = [] //todo setup in logs
    this.round = 1
    this.turnPlayer = 0
    this.priorityPlayer = 0
    this.nextId = 0
    this.setup(decklists)
  }

  setup(decklists: Decklist[]) {
    for (const [playerIndex, decklist] of decklists.entries()) {
      for (const world of decklist.worlds) {
        const card = this.spawnCard(playerIndex, world)
        this.moveCardToZone(card, "World")
      }
      for (const ex of decklist.ex) {
        const card = this.spawnCard(playerIndex, ex)
        this.moveCardToZone(card, "EX")
      }
      for (const main of decklist.main) {
        const card = this.spawnCard(playerIndex, main)
        this.moveCardToZone(card, "Deck")
      }
      //todo server rng
      this.shuffleDeck(playerIndex)
    }
  }

  shuffleDeck(player: number): void {
    this.players[player]!.deck = shuffle(this.players[player]!.deck)
  }

  // findCard(id: number): Zone | null {
  //   const zones: Zone[] = [...ALL_ZONES]
  //   for (const z of zones) {
  //     const cards = this.cardsInZone(z)
  //     if (cards.some(c => c.id === id)) return z
  //   }
  //   return null
  // }

  spawnCard(player: number, definition: CardDefinition): Card {
    const card = new Card(this.nextId, definition, player)
    this.nextId++
    return card
  }

  moveCardToZone(card: Card, zone: Zone): void {
    const oldZone = this.findCard(card.id)
    if (oldZone === "Deck")
      this.deck = this.deck.filter(c => c.id !== card.id)
    else if (oldZone === "EX")
      this.ex = this.ex.filter(c => c.id !== card.id)
    else if (oldZone === "Hand")
      this.hand = this.hand.filter(c => c.id !== card.id)
    else if (oldZone === "Field")
      this.field = this.field.filter(c => c.id !== card.id)
    else if (oldZone === "GY")
      this.gy = this.gy.filter(c => c.id !== card.id)
    else if (oldZone === "Suspense")
      this.suspense = this.suspense.filter(c => c.id !== card.id)
    else if (oldZone === "Deletion")
      this.deletion = this.deletion.filter(c => c.id !== card.id)
    else if (oldZone === "World")
      this.worldZone = this.worldZone.filter(c => c.id !== card.id)
    if (zone === "Deck") this.deck.push(card)
    else if (zone === "EX") this.ex.push(card)
    else if (zone === "Hand") this.hand.push(card)
    else if (zone === "Field") this.field.push(card)
    else if (zone === "GY") this.gy.push(card)
    else if (zone === "Suspense") this.suspense.push(card)
    else if (zone === "Deletion") this.deletion.push(card)
    else if (zone === "World") this.worldZone.push(card)
    else throw new Error(`trying to move "${card.name}" to unknown zone ${zone}`)
  }

  private buildEffectAtoms(card: Card, ability: Ability, player: number): EffectAtom[] {
    //todo targets
    const atoms: EffectAtom[] = []
    const meta: EffectAtomMeta = { source: card, ability, player }
    for (const eff of ability.effects) {
      if (eff.type === "Summon") {
        atoms.push({ type: "Move", meta, card, moveName: "Summoned", to: "Field" })
      } else if (eff.type === "Send to") {
        atoms.push({ type: "Move", meta, card, to: eff.to })
      } else if (eff.type === "Sacrifice") {
        atoms.push({ type: "Move", meta, card, moveName: "Sacrificed", to: "GY" })
      } else {
        throw new Error(`unknown effect type in eff ${eff}`)
      }
    }
    return atoms
  }

  private applyEffectAtoms(atoms: EffectAtom[]) {
    for (const atom of atoms) {
      if (atom.type === "Move") {
        //todo need to know whose board we're in!!!
      } else {
        throw new Error(`unknown effect atom type ${atom}`)
      }
    }
  }
}

class Decklist {
  worlds: CardDefinition[]
  main: CardDefinition[]
  ex: CardDefinition[]

  constructor(cards: CardDefinition[]) {
    const worlds = []
    const main = []
    const ex = []
    for (const card of cards) {
      if (card.cardType === "World") {
        worlds.push(card)
      } else if (card.ex) {
        ex.push(card)
      } else {
        main.push(card)
      }
    }
    this.worlds = worlds
    this.ex = ex
    this.main = main
  }
}

const ALL_ZONES = ["Deck", "EX", "Hand", "Field", "GY", "Suspense", "Deletion", "World"] as const
type Zone = typeof ALL_ZONES[number]

class BoardState {
  gameState: GameState
  deck: Card[] //todo handle hidden nature; also card theft
  ex: Card[]
  hand: Card[]
  field: Card[]
  gy: Card[]
  suspense: Card[]
  deletion: Card[]
  worldZone: Card[]

  constructor(gs: GameState) {
    this.gameState = gs
    this.deck = []
    this.ex = []
    this.hand = []
    this.field = []
    this.gy = []
    this.suspense = []
    this.deletion = []
    this.worldZone = []
  }

  cardsInZone(zone: Zone): Card[] {
    switch (zone) {
      case "Deck": return this.deck
      case "EX": return this.ex
      case "Hand": return this.hand
      case "Field": return this.field
      case "GY": return this.gy
      case "Suspense": return this.suspense
      case "Deletion": return this.deletion
      case "World": return this.worldZone
    }
  }
}

type Color = "Red" | "Orange" | "Yellow" | "Green" | "Teal" | "Blue" | "Purple"

type CardType = "World" | "Esper" | "Core" | "Vision"

class CardDefinition {
  identifier: string
  name: string
  colors: Color[]
  cardType: CardType
  ex: boolean
  // restriction?: Restriction

  constructor(identifier: string, name: string, colors: Color[], cardType: CardType, ex: boolean) {
    this.identifier = identifier
    this.name = name
    this.colors = colors
    this.cardType = cardType
    this.ex = ex
  }
}

class Card {
  id: number
  definition: CardDefinition
  name: string
  colors: Color[] //todo set
  cardType: CardType
  ex: boolean
  ownedBy: number
  controlledBy: number

  constructor(id: number, definition: CardDefinition, ownedBy: number) {
    this.id = id
    this.definition = definition
    this.name = definition.name
    this.colors = definition.colors
    this.cardType = definition.cardType
    this.ex = definition.ex
    this.ownedBy = ownedBy
    this.controlledBy = ownedBy
  }
}

// --------------- effs --------------- //

type EffectAtomMeta = {
  source?: Card
  ability?: Ability
  player: number
}

type MoveName = "Summoned" | "Destroyed" | "Sacrificed" | "Excavated"

type Effect = { type: "Summon" } | { type: "Send to", to: Zone } | { type: "Sacrifice" }

type EffectAtom = { meta: EffectAtomMeta, type: "Move", moveName?: MoveName, card: Card, to: Zone } //todo should from be here?

type Trigger = { type: "Activated" } | { type: "This moves", from?: Zone, to?: Zone }

type Comparison = { type: "At least", n: number }
  | { type: "At most", n: number }
  | { type: "Equal to", n: number }

type Condition = { type: "Number in zone", zone: Zone, comparison: Comparison, criteria: CardCriteria[] }

type CardCriteria = { type: "Any of", subcriteria: CardCriteria[] }
  | { type: "None of", subcriteria: CardCriteria[] }
  | { type: "Name includes", substring: string }
  | { type: "Colors are exactly", colors: Color[] }
  | { type: "Colors within", colors: Color[] }
  | { type: "In Zone", zone: Zone }

type Ability = {
  trigger: Trigger
  conditions?: Condition[]
  effects: Effect[]
  target?: CardCriteria[]
}



// --------------- test --------------- //

const d = new CardDefinition(
  "TEST-001",
  "Pythagorean Angel",
  ["Yellow", "Teal"],
  "Esper",
  false
)
const list = new Decklist(Array(50).fill(d))
const game = new GameState([list])
const player = game.players[0]!
console.log(`${player.hand.length} in hand, ${player.deck.length} in deck`)
player.moveCardToZone(player.deck[0]!, "Hand")
console.log(`${player.hand.length} in hand, ${player.deck.length} in deck`)