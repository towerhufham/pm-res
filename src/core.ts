import { shuffle } from "./util"

type LogEntry = { type: "Effects", effectAtom: EffectAtom[] }
  | { type: "Activation", card: Card, ability: Ability }
  | { type: "Trigger", card: Card, ability: Ability }
  | { type: "End Turn" }

class GameState {
  players: Decklist[]
  cards: Card[]
  log: LogEntry[]
  round: number
  turnPlayer: number
  priorityPlayer: number
  nextId: number

  constructor(decklists: Decklist[]) {
    this.players = decklists
    this.cards = []
    this.log = [] //todo setup in logs
    this.round = 1
    this.turnPlayer = 0
    this.priorityPlayer = 0
    this.nextId = 0
    this.setup()
  }

  setup() {
    for (const [playerIndex, decklist] of this.players.entries()) {
      for (const world of decklist.worlds) {
        const card = this.spawnCard(playerIndex, world)
        this.moveCard(card, "World")
      }
      for (const ex of decklist.ex) {
        const card = this.spawnCard(playerIndex, ex)
        this.moveCard(card, "EX")
      }
      for (const main of decklist.main) {
        const card = this.spawnCard(playerIndex, main)
        this.moveCard(card, "Deck")
      }
      //todo server rng
      // this.shuffleDeck(playerIndex)
    }
  }

  // shuffleDeck(player: number): void {
  //   this.players[player]!.deck = shuffle(this.players[player]!.deck)
  // }

  moveCard(card: Card, to: Zone): void {
    //todo maybe guard ex as well
    // if (to === "Deck") throw new Error("can't use moveCard to move to deck!")
    card.zone = to
  }

  spawnCard(player: number, definition: CardDefinition): Card {
    const card = new Card(this.nextId, definition, player)
    this.cards.push(card)
    this.nextId++
    return card
  }

  cardsInZone(player: number, zone: Zone): Card[] {
    return this.cards.filter(c => c.ownedBy === player && c.zone === zone)
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
  zone: Zone

  constructor(id: number, definition: CardDefinition, ownedBy: number) {
    this.id = id
    this.definition = definition
    this.name = definition.name
    this.colors = definition.colors
    this.cardType = definition.cardType
    this.ex = definition.ex
    this.ownedBy = ownedBy
    this.controlledBy = ownedBy
    //todo this logic is duplicated and easily extractible
    if (definition.cardType === "World") {
      this.zone = "World"
    } else if (definition.ex) {
      this.zone = "EX"
    } else {
      this.zone = "Deck"
    }
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
console.log(`${game.cardsInZone(0, "Hand").length} in player 0's hand, ${game.cardsInZone(0, "Deck").length} in deck`)
game.moveCard(game.cards[0]!, "Hand")
console.log(`${game.cardsInZone(0, "Hand").length} in player 0's hand, ${game.cardsInZone(0, "Deck").length} in deck`)