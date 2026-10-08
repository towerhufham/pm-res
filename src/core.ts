import { shuffle } from "./util"
import { Chain } from "./chain"

//current mysteries
//how does the server manage rng and secrets?
//how do we order the deck?

export class RulesError extends Error {
  constructor(message: string, data?: unknown) {
    let fullMessage = ""
    if (data !== undefined) {
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

export class GameState {
  players: Decklist[]
  cards: Card[]
  log: LogEntry[]
  round: number
  turnPlayer: number
  nextId: number
  chain: Chain | null

  constructor(decklists: Decklist[]) {
    if (decklists.length === 0) throw new RulesError(`can't make a game with no players!`)
    this.players = decklists
    this.cards = []
    this.log = [] //todo setup in logs
    this.round = 1
    this.turnPlayer = 0
    this.nextId = 0
    this.chain = null
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
    //todo draw hand and/or mulligans
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

  nextPlayer(player: number): number {
    return (player >= this.players.length - 1) ? 0 : player + 1
  }

  buildEffectAtoms(link: ChainLink): EffectAtom[] {
    //todo check to make sure the targets in ac are valid
    const atoms: EffectAtom[] = []
    for (const eff of link.ability.effects) {
      if (eff.type === "Summon this") {
        atoms.push({type: "Move", link, card: link.card, moveName: "Summoned", to: "Field"})
      } else if (eff.type === "Send this to") {
        atoms.push({type: "Move", link, card: link.card, to: eff.to})
      } else if (eff.type === "Sacrifice this") {
        atoms.push({type: "Move", link, card: link.card, moveName: "Sacrificed", to: "GY"})
      } else if (eff.type === "Send targets to") {
        const targets = link.targets![eff.tag]
        if (!targets) throw new RulesError("no targets for tag", eff.tag)
        for (const target of targets) {
          atoms.push({type: "Move", link, card: target, to: eff.to})
        }
      } else if (eff.type === "Send all to GY") {
        let allOnField: Card[] = []
        for (let i = 0; i < this.players.length; i++) {
          allOnField = [...allOnField, ...this.cardsInZone(i, "Field")]
        }
        for (const card of allOnField) {
          atoms.push({type: "Move", link, card, to: "GY"})
        }
      } else {
        throw new RulesError("unknown effect type in eff", eff)
      }
    }
    return atoms
  }

  applyEffectAtoms(atoms: EffectAtom[]): void {
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
        if (this.checkCriteria(asPlayer, card, sub)) return true
      }
      return false
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
      return card.colors.length === criteria.colors.length 
        && card.colors.every((color, i) => color === criteria.colors[i])
    } else if (criteria.type === "Colors within") {
      return card.colors.every(color => criteria.colors.includes(color))
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
    if (ac.ability.style.type !== "Activated") return false
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

  //todo (minor) this method can be overloaded to take ac + targets as well
  startActivation(link: ChainLink): void {
    if (!this.canActivateAbility(link)) {
      throw new RulesError("trying to activate non-activatable ability", link)
    }
    this.chain = new Chain(this, link)
  }

  checkForTriggers(atoms: EffectAtom[]): AbilityContext[] {
    //todo make this logic less... bad
    const triggerable: AbilityContext[] = []
    for (const atom of atoms) {
      for (const card of this.cards) {
        for (const ability of card.abilities) {
          if (ability.style.type === "Activated") continue
          else if (ability.style.trigger.type === "This moves") {
            if (atom.type === "Move" && atom.card === card && atom.to === ability.style.trigger.to) {
              triggerable.push({player: card.controlledBy, card, ability})
            }
          }
        }
      }
    }
    return triggerable
  }

  getZoneCounts(): ZoneCounts {
    const counts: ZoneCounts = []
    for (let i = 0; i < this.players.length; i++) {
      const cards = this.cards.filter(c => c.controlledBy === i)
      counts.push({
        "Deck": cards.filter(c => c.zone === "Deck").length,
        "Deletion": cards.filter(c => c.zone === "Deletion").length,
        "EX": cards.filter(c => c.zone === "EX").length,
        "Field": cards.filter(c => c.zone === "Field").length,
        "GY": cards.filter(c => c.zone === "GY").length,
        "Hand": cards.filter(c => c.zone === "Hand").length,
        "Suspense": cards.filter(c => c.zone === "Suspense").length,
        "World": cards.filter(c => c.zone === "World").length
      })
    }
    return counts
  }

  getVisibleCards(player: number): Card[] {
    const ours = this.cards.filter(c => c.ownedBy === player)
    const publicZones: Zone[] = ["Field", "GY", "World", "Deletion", "Suspense"]
    const theirs = this.cards.filter(c => c.ownedBy !== player).filter(c => publicZones.includes(c.zone))
    return [...ours, ...theirs]
  }

  getWaitingFor(player: number): WaitingFor {
    //when there's no current chain
    if (!this.chain) {
      if (this.turnPlayer === player) {
        return {type: "Open", options: this.getAllActivatableAbilities(player)}
      } else {
        return {type: "Another player", player: this.turnPlayer}
      }
    } else {
      //when there is a chain it gets tricky
      if (this.chain.playerWithPriority === player) {
        if (this.chain.state === "Building") {
          //todo how get these?
          return {type: "Response window", options: [], links: this.chain.links}
        } else if (this.chain.state === "Ordering triggers") {
          //todo how get these too?
          return {type: "Triggers", triggers: [], currentLinks: this.chain.links, triggerPool: this.chain.pendingTriggerPool}
        } else {
          //i think this might be an unreachable state? unsure
          throw new RulesError("can't figure out playerstate because chain state is", this.chain.state)
        }
      } else {
        return {type: "Another player", player: this.chain.playerWithPriority}
      }
    }
  }

  getPlayerState(player: number): PlayerState {
    return {
      visibleCards: this.getVisibleCards(player),
      zoneCounts: this.getZoneCounts(),
      waitingFor: this.getWaitingFor(player),
      playerList: [...Array(this.players.length).keys()], //todo want more info than just number[]
      log: this.log,
      round: this.round,
      turnPlayer: this.turnPlayer
    }
  }

  endChain(): void {
    this.chain = null
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

//todo these can be more composable (even on top of EffectAtom composition) 
//we're gonna use shorthand alias variables, so
export type Effect = {type: "Summon this"} 
  | {type: "Send this to", to: Zone}
  | {type: "Sacrifice this"}
  | {type: "Send targets to", to: Zone, tag: string}
  | {type: "Send all to GY"} //mostly debug

export type TargetingGroup = {type: "Single Target", criteria: CardCriteria[], tag: string}
  | {type: "Multi Target", criteria: CardCriteria[], tag: string}

export type FinalizedTargets = Record<string, Card[]>

export type EffectAtom = {link: ChainLink, type: "Move", moveName?: MoveName, card: Card, to: Zone} //todo should from be here?
  | {link: ChainLink, type: "Target", card: Card, tag: string}

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

export type Ability = {
  style: {type: "Activated"} | {type: "Trigger", mandatory: boolean, trigger: Trigger}
  conditions?: Condition[]
  targetingGroups: TargetingGroup[]
  effects: Effect[]
  //todo hopt
}

// type TargetPayload = {type: "Single Card", target: Card}
//   | {type: "Multi Card", targets: Card[]}

export type AbilityContext = {player: number, card: Card, ability: Ability}
export type ChainLink = AbilityContext & {targets: FinalizedTargets}


//--------------- Interface ---------------//

export type WaitingFor = {
  type: "Another player"
  player: number
} | {
  type: "Open"
  options: AbilityContext[]
} | {
  type: "Response window"
  options: AbilityContext[]
  links: ChainLink[]
} | {
  type: "Triggers"
  triggers: AbilityContext[]
  currentLinks: ChainLink[]
  //this will be triggerLinks: ChainLink[] once we order triggers as they come instead of in batches
  triggerPool: AbilityContext[]
}

type ZoneCounts = Record<Zone, number>[]

export type PlayerState = {
  visibleCards: Card[]
  zoneCounts: ZoneCounts
  waitingFor: WaitingFor
  playerList: number[] //todo this will have names and metadata stuffs
  log: LogEntry[]
  round: number
  turnPlayer: number
}