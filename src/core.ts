import { shuffle } from "./util"

//current mysteries
//how does the server manage rng and secrets?
//how do we order the deck?

export class RulesError extends Error {
  constructor(message: string, data?: unknown) {
    let fullMessage = ""
    if (data) {
      try {
        fullMessage = `[Rules Error: ${message}] ${JSON.stringify(data)}`
      } catch (e: unknown) {
        fullMessage = `[Rules Error: ${message}] (data couldn't be stringified)`
      }
    } else {
      fullMessage = `[Rules Error ${message}]`
    }
    super(fullMessage)
    this.name = "RulesError"
    Object.setPrototypeOf(this, RulesError.prototype)
  }
}

export type LogEntry = {type: "Effects", effectAtom: EffectAtom[]}
  | {type: "Activation", ac: AbilityContext}
  | {type: "Trigger", ac: AbilityContext}
  | {type: "End Turn"}

//todo server rng response, mulligans, betting, arbitrary choices
export type WaitingOn = {type: "Setting up..."}
  | {type: "Main", player: number, options: AbilityContext[]}
  | {type: "Targeting", ac: AbilityContext, targetingGroups: TargetingGroup[], validTargetLists: Card[][]}
  | {type: "Optional trigger", ac: AbilityContext}
  | {type: "Trigger ordering", acs: AbilityContext[]}

export class GameState {
  players: Decklist[]
  cards: Card[]
  log: LogEntry[]
  round: number
  turnPlayer: number
  waitingOn: WaitingOn
  nextId: number

  constructor(decklists: Decklist[]) {
    if (decklists.length === 0) throw new RulesError(`can't make a game with no players!`)
    this.players = decklists
    this.cards = []
    this.log = [] //todo setup in logs
    this.round = 1
    this.turnPlayer = 0
    this.waitingOn = {type: "Setting up..."}
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
    //todo draw hand and/or mull
    this.waitingOn = {type: "Main", player: 0, options: this.getAllActivatableAbilities(0)}
  }

  // shuffleDeck(player: number): void {
  //   this.players[player]!.deck = shuffle(this.players[player]!.deck)
  // }

  moveCard(card: Card, to: Zone): void {
    //todo maybe guard ex as well
    // if (to === "Deck") throw new RulesError("can't use moveCard to move to deck!")
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

  private buildEffectAtoms(ac: AbilityContext): EffectAtom[] {
    //todo check to make sure the targets in ac are valid
    const atoms: EffectAtom[] = []
    for (const eff of ac.ability.effects) {
      if (eff.type === "Summon this") {
        atoms.push({type: "Move", ac, card: ac.card, moveName: "Summoned", to: "Field"})
      } else if (eff.type === "Send this to") {
        atoms.push({type: "Move", ac, card: ac.card, to: eff.to})
      } else if (eff.type === "Sacrifice this") {
        atoms.push({type: "Move", ac, card: ac.card, moveName: "Sacrificed", to: "GY"})
      } else if (eff.type === "Send targets to") {
        // if (!ac.targets) throw new RulesError("trying to 'send target to' with no finalized targets")
        const targets = ac.targets![eff.tag]
        if (!targets) throw new RulesError("no targets for tag", eff.tag)
        for (const target of targets) {
          atoms.push({type: "Move", ac, card: target, to: eff.to})
        }
      } else {
        throw new RulesError("unknown effect type in eff", eff)
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
        throw new RulesError("unknown effect atom type", atom)
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
      throw new RulesError("unknown criteria", criteria)
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
      throw new RulesError("unknown condition", cond)
    }
  }

  canActivateAbility(ac: AbilityContext): boolean {
    if (ac.ability.trigger.type !== "Activated") return false
    //todo hopt
    if (ac.ability.conditions) {
      for (const cond of ac.ability.conditions) {
        if (!this.checkCondition(ac.player, ac.card, cond)) return false
      }
    }
    if (ac.ability.targetingGroups.length > 0) {
      for (const group of ac.ability.targetingGroups) {
        if (this.getAllByCriteria(ac.player, group.criteria).length === 0) return false
      }
    }
    return true
  }

  getAllActivatableAbilities(player: number): AbilityContext[] {
    const found: AbilityContext[] = []
    for (const card of this.cards) {
      for (const ability of card.abilities) {
        const ac = {player, card, ability}
        if (this.canActivateAbility(ac)) found.push(ac)
      }
    }
    return found
  }

  startActivation(ac: AbilityContext): void {
    if (!this.canActivateAbility(ac)) {
      throw new RulesError("trying to activate non-activatable ability", ac)
    }
    //todo replace this block with a target validation function (also used above)
    const targetingGroups = ac.ability.targetingGroups
    if (targetingGroups.length === 0) {
      this.applyEffect(ac)
    } else {
      const validTargetLists = []
      for (const group of targetingGroups) {
        validTargetLists.push(this.getAllByCriteria(ac.player, group.criteria))
      }
      this.waitingOn = {type: "Targeting", ac, targetingGroups, validTargetLists}
    }
  }

  supplyTargets(targets: FinalizedTargets): void {
    if (this.waitingOn.type !== "Targeting") throw new RulesError("supplying targets while not waiting for them", this.waitingOn)
    // if (!this.areTargetsApplicable(targets, this.waitingOn.ac))
    this.applyEffect({...this.waitingOn.ac, targets})
  }

  applyEffect(ac: AbilityContext): void {
    //todo more target validation
    const atoms = this.buildEffectAtoms(ac)
    this.applyEffectAtoms(atoms)
    //todo won't always be ac's player!
    this.waitingOn = {type: "Main", player: ac.player, options: this.getAllActivatableAbilities(ac.player)}
  }
}

export class Decklist {
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

export const ALL_ZONES = ["Deck", "EX", "Hand", "Field", "GY", "Suspense", "Deletion", "World"] as const
export type Zone = typeof ALL_ZONES[number]

export const ALL_COLORS = ["Red", "Orange", "Yellow", "Green", "Teal", "Blue", "Purple"] as const
export type Color = typeof ALL_COLORS[number]

export type CardType = "World" | "Esper" | "Core" | "Vision"

export type CardDefinition = {
  identifier: string
  name: string
  colors: Color[]
  cardType: CardType
  ex: boolean
  // restriction?: Restriction
  abilities: Ability[]
}

export class Card {
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


export type MoveName = "Summoned" | "Destroyed" | "Sacrificed" | "Excavated"

export type Effect = {type: "Summon this"} 
  | {type: "Send this to", to: Zone}
  | {type: "Sacrifice this"}
  | {type: "Send targets to", to: Zone, tag: string}

export type TargetingGroup = {type: "Single Target", criteria: CardCriteria[], tag: string}
  | {type: "Multi Target", criteria: CardCriteria[], tag: string}

export type FinalizedTargets = Record<string, Card[]>

export type EffectAtom = {ac: AbilityContext, type: "Move", moveName?: MoveName, card: Card, to: Zone} //todo should from be here?
  | {ac: AbilityContext, type: "Target", card: Card, tag: string}

export type Trigger = {type: "Activated"} | {type: "This moves", from?: Zone, to?: Zone}

export type Comparison = {type: "At least", n: number}
  | {type: "At most", n: number}
  | {type: "Equal to", n: number}

export const checkComparison = (value: number, comp: Comparison): boolean => {
  if (comp.type === "At least") {
    return value >= comp.n
  } else if (comp.type === "At most") {
    return value <= comp.n
  } else if (comp.type === "Equal to") {
    return value === comp.n
  } else {
    throw new RulesError("unknown comparison", comp)
  }
}

export type Condition = { type: "Count cards", comparison: Comparison, criteria: CardCriteria[] }
  | {type: "In zone", zone: Zone}

export type CardCriteria = { type: "Any of", subcriteria: CardCriteria[] }
  | { type: "None of", subcriteria: CardCriteria[] }
  | { type: "Name includes", substring: string }
  | { type: "Colors are exactly", colors: Color[] }
  | { type: "Colors within", colors: Color[] }
  | { type: "In Zone", zone: Zone }
  | { type: "Controlled by", who: "Us" | "Opponent"}

export type Ability = {
  trigger: Trigger
  mandatory: boolean
  reactor: boolean
  conditions?: Condition[]
  targetingGroups: TargetingGroup[]
  effects: Effect[]
  //todo hopt
}

// type TargetPayload = {type: "Single Card", target: Card}
//   | {type: "Multi Card", targets: Card[]}

export type AbilityContext = {player: number, card: Card, ability: Ability, targets?: FinalizedTargets}

// --------------- test --------------- //

// const d = new CardDefinition(
//   "TEST-001",
//   "Pythagorean Angel",
//   ["Yellow", "Teal"],
//   "Esper",
//   false,
//   [
//     {
//       trigger: {type: "Activated"},
//       mandatory: false,
//       reactor: false,
//       conditions: [{type: "In zone", zone: "Hand"}],
//       targetingGroups: [],
//       effects: [{type: "Summon this"}]
//     }, {
//       trigger: {type: "Activated"},
//       mandatory: false,
//       reactor: false,
//       conditions: [{type: "In zone", zone: "Field"}],
//       targetingGroups: [{type: "Single Target", criteria: [{type: "In Zone", zone: "Field"}], tag: ""}],
//       effects: [{type: "Send targets to", to: "GY", tag: ""}]
//     }
//   ]
// )
// const list = new Decklist(Array(50).fill(d))
// const game = new GameState([list])
// console.log(`${game.cardsInZone(0, "Hand").length} in player 0's hand, ${game.cardsInZone(0, "Deck").length} in deck`)
// console.log(`${game.getAllActivatableAbilities(0).length} activatable abilities`)
// game.draw(0)
// console.log(`${game.cardsInZone(0, "Hand").length} in player 0's hand, ${game.cardsInZone(0, "Deck").length} in deck`)
// console.log(`${game.getAllActivatableAbilities(0).length} activatable abilities`)
// const ac = game.getAllActivatableAbilities(0)[0]!
// game.startActivation(ac)
// console.log(`${game.cardsInZone(0, "Field").length} on field`)
// console.log(`${game.getAllActivatableAbilities(0).length} activatable abilities`)
// const onfield = game.cardsInZone(0, "Field")[0]!
// game.startActivation({player: 0, card: onfield, ability: onfield.abilities[1]!})
// console.log(`waiting on: ${game.waitingOn.type}`)
// game.supplyTargets({"": [onfield]})
// console.log(`${game.cardsInZone(0, "Field").length} on field`)
// console.log(`waiting on: ${game.waitingOn.type}`)
// throw new RulesError("testing!", onfield)