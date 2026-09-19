import { shuffle } from "./util"

type LogEntry = { type: "Effects", effectAtom: EffectAtom[] }
  | { type: "Activation", card: Card, ability: Ability }
  | { type: "Trigger", card: Card, ability: Ability }
  | { type: "End Turn" }

//todo maybe [Card, Ability] should be a standardized type, or maybe it's self-explanatory

//todo server rng response, mulligans, betting, arbitrary choices
type WaitingOn = {type: "Main", player: number}
  | {type: "Targets", player: number, card: Card, ability: Ability}
  | {type: "Optional trigger", player: number, card: Card, ability: Ability}
  | {type: "Trigger order", player: number, cardsAndAbilities: [Card, Ability][]}

class GameState {
  players: Decklist[]
  cards: Card[]
  log: LogEntry[]
  round: number
  turnPlayer: number
  waitingOn: WaitingOn
  nextId: number

  constructor(decklists: Decklist[]) {
    if (decklists.length === 0) throw new Error(`can't make a game with no players!`)
    this.players = decklists
    this.cards = []
    this.log = [] //todo setup in logs
    this.round = 1
    this.turnPlayer = 0
    this.waitingOn = {type: "Main", player: 0}
    this.nextId = 0
    this.setup()
  }

  setup(): void {
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
      //todo deck order and/or server rng
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

  draw(player: number): boolean {
    //false if decked out
    const inDeck = this.cardsInZone(player, "Deck")
    if (inDeck.length === 0) return false
    //todo log?
    this.moveCard(inDeck[0]!, "Hand")
    return true
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

  //todo these arguments are in wrong order lol
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

  private applyEffectAtoms(atoms: EffectAtom[]): void {
    //todo check triggers
    for (const atom of atoms) {
      if (atom.type === "Move") {
        this.moveCard(atom.card, atom.to)
      } else {
        throw new Error(`unknown effect atom type ${atom}`)
      }
    }
  }

  checkCriteria(asPlayer: number, card: Card, criteria: CardCriteria | CardCriteria[]): boolean {
    if (Array.isArray(criteria)) return criteria.every(c => this.checkCriteria(asPlayer, card, c))
    if (criteria.type === "Any of") {
      for (const sub of criteria.subcriteria) {
        if (!this.checkCriteria(asPlayer, card, sub)) return false
      }
      return true
    } else if (criteria.type === "None of") {
      for (const sub of criteria.subcriteria) {
        if (this.checkCriteria(asPlayer, card, sub)) return false
      }
      return true
    } else if (criteria.type === "In Zone") {
      return card.zone === criteria.zone
    } else if (criteria.type === "Name includes") {
      return card.name.includes(criteria.substring)
    } else if (criteria.type === "Colors are exactly") {
      return card.colors.every((color, i) => color === criteria.colors[i])
    } else if (criteria.type === "Colors within") {
      return card.colors.every(color => criteria.colors.includes(color))
    } else if (criteria.type === "Controlled by") {
      return card.controlledBy === asPlayer
    } else {
      throw new Error(`unknown criteria ${criteria}`)
    }
  }

  getAllByCriteria(asPlayer: number, criteria: CardCriteria[]): Card[] {
    return this.cards.filter(c => this.checkCriteria(asPlayer, c, criteria))
  }

  checkCondition(asPlayer: number, card: Card, cond: Condition): boolean {
    if (cond.type === "Count cards") {
      const count = this.getAllByCriteria(asPlayer, cond.criteria).length
      return checkComparison(count, cond.comparison)
    } else if (cond.type === "In zone") {
      return card.zone === cond.zone
    } else {
      throw new Error(`unknown condition ${cond}`)
    }
  }

  canActivateAbility(player: number, card: Card, ability: Ability): boolean {
    if (ability.trigger.type !== "Activated") return false
    //todo hopt
    if (ability.conditions) {
      for (const cond of ability.conditions) {
        if (!this.checkCondition(player, card, cond)) return false
      }
    }
    //todo valid targets
    return true
  }

  getAllActivatableAbilities(player: number): [Card, Ability][] {
    const found: [Card, Ability][] = []
    for (const card of this.cards) {
      for (const ability of card.abilities) {
        if (this.canActivateAbility(player, card, ability)) found.push([card, ability])
      }
    }
    return found
  }

  startActivation(player: number, card: Card, ability: Ability): void {
    if (!this.canActivateAbility(player, card, ability)) {
      throw new Error(`trying to activate ability ${ability}`)
    }
    if (!ability.target) {
      //todo this should be extracted for safety/DRY reasons
      const atoms = this.buildEffectAtoms(card, ability, player)
      this.applyEffectAtoms(atoms)
    } else {
      this.waitingOn = {type: "Targets", player, card, ability}
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
  abilities: Ability[]

  constructor(identifier: string, name: string, colors: Color[], cardType: CardType, ex: boolean, abilities: Ability[]) {
    this.identifier = identifier
    this.name = name
    this.colors = colors
    this.cardType = cardType
    this.ex = ex
    this.abilities = abilities
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
  abilities: Ability[]

  constructor(id: number, definition: CardDefinition, ownedBy: number) {
    this.id = id
    this.definition = definition
    this.name = definition.name
    this.colors = definition.colors
    this.cardType = definition.cardType
    this.ex = definition.ex
    this.ownedBy = ownedBy
    this.controlledBy = ownedBy
    this.abilities = definition.abilities
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

const checkComparison = (value: number, comp: Comparison): boolean => {
  if (comp.type === "At least") {
    return value >= comp.n
  } else if (comp.type === "At most") {
    return value <= comp.n
  } else if (comp.type === "Equal to") {
    return value === comp.n
  } else {
    throw new Error(`unknown comparison ${comp}`)
  }
}

type Condition = { type: "Count cards", comparison: Comparison, criteria: CardCriteria[] }
  | {type: "In zone", zone: Zone}

type CardCriteria = { type: "Any of", subcriteria: CardCriteria[] }
  | { type: "None of", subcriteria: CardCriteria[] }
  | { type: "Name includes", substring: string }
  | { type: "Colors are exactly", colors: Color[] }
  | { type: "Colors within", colors: Color[] }
  | { type: "In Zone", zone: Zone }
  | { type: "Controlled by", who: "Us" | "Opponent"}

type Ability = {
  trigger: Trigger
  mandatory: boolean
  reactor: boolean
  conditions?: Condition[]
  effects: Effect[]
  target?: TargetType
  //todo hopt
}

type TargetType = {type: "Single Card", criteria: CardCriteria[]}
  | {type: "Multi Card", comparison: Comparison, criteria: CardCriteria[]}
  | {type: "A and B", criteriaA: CardCriteria[], criteriaB: CardCriteria[]}

// --------------- test --------------- //

const d = new CardDefinition(
  "TEST-001",
  "Pythagorean Angel",
  ["Yellow", "Teal"],
  "Esper",
  false,
  [
    {
      trigger: {type: "Activated"},
      mandatory: false,
      reactor: false,
      conditions: [{type: "In zone", zone: "Hand"}],
      effects: [{type: "Summon"}]
    }
  ]
)
const list = new Decklist(Array(50).fill(d))
const game = new GameState([list])
console.log(`${game.cardsInZone(0, "Hand").length} in player 0's hand, ${game.cardsInZone(0, "Deck").length} in deck`)
console.log(`${game.getAllActivatableAbilities(0).length} activatable abilities`)
game.draw(0)
console.log(`${game.cardsInZone(0, "Hand").length} in player 0's hand, ${game.cardsInZone(0, "Deck").length} in deck`)
console.log(`${game.getAllActivatableAbilities(0).length} activatable abilities`)
const cardAndAbility = game.getAllActivatableAbilities(0)[0]!
game.startActivation(0, cardAndAbility[0], cardAndAbility[1])
console.log(`${game.cardsInZone(0, "Field").length} on field`)
console.log(`${game.getAllActivatableAbilities(0).length} activatable abilities`)