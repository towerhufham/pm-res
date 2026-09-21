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

export type LogEntry = {type: "Effects", effectAtoms: EffectAtom[]}
  | {type: "Activation", ac: AbilityContext}
  | {type: "Trigger", ac: AbilityContext}
  | {type: "End Turn"}

//todo server rng response, mulligans, betting, arbitrary choices
//
// The trigger stack, end to end:
//  - queueTriggers() is the one entrypoint for "some new triggers just appeared".
//    It's called after any effect resolves (including activations with no targets)
//    and after any targets get supplied. It hands the new triggers to placeNewTriggers,
//    which puts them on top of whatever stack was already waiting underneath.
//  - placeNewTriggers() walks players in priority order (APNAP-ish) and lets each one
//    order their own simultaneous triggers, pausing on "Ordering triggers" only when a
//    player actually has a choice to make (2+ triggers). Once everyone's triggers are
//    placed, the merged list becomes the new stack and advanceStack() takes over.
//  - advanceStack() looks at the top of the stack. Optional (non-mandatory) triggers
//    pause on "Optional trigger" so their controller can decline them outright; everything
//    else goes to resolveStackItem().
//  - resolveStackItem() is also what startActivation() and supplyTargets() funnel into -
//    an ability with targeting groups pauses on "Targeting" (carrying the rest of the
//    stack along with it), otherwise it resolves immediately and loops back into
//    queueTriggers() with whatever it triggered.
// So "stack"/"restOfStack" fields below always mean "what resolves after this step."
export type WaitingOn = {type: "Setting up..."}
  | {type: "Main", player: number, options: AbilityContext[]}
  | {type: "Targeting", ac: AbilityContext, targetingGroups: TargetingGroup[], validTargetLists: Card[][], stack: AbilityContext[]}
  | {type: "Optional trigger", ac: AbilityContext, stack: AbilityContext[]}
  | {type: "Ordering triggers", remainingPlayers: number[], ordered: AbilityContext[], toOrder: AbilityContext[], unplaced: AbilityContext[], stack: AbilityContext[]}

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

  private buildEffectAtoms(ac: AbilityContext, finalTargets: FinalizedTargets): EffectAtom[] {
    //todo targets
    const atoms: EffectAtom[] = []
    for (const eff of ac.ability.effects) {
      if (eff.type === "Summon this") {
        atoms.push({type: "Move", ac, card: ac.card, moveName: "Summoned", to: "Field"})
      } else if (eff.type === "Send this to") {
        atoms.push({type: "Move", ac, card: ac.card, to: eff.to})
      } else if (eff.type === "Sacrifice this") {
        atoms.push({type: "Move", ac, card: ac.card, moveName: "Sacrificed", to: "GY"})
      } else if (eff.type === "Send targets to") {
        const targets = finalTargets[eff.tag]
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

  waitForTargets(ac: AbilityContext, stack: AbilityContext[]): void {
    const validTargetLists = []
    const targetingGroups = ac.ability.targetingGroups
    for (const group of targetingGroups) {
      validTargetLists.push(this.getAllByCriteria(ac.player, group.criteria))
    }
    this.waitingOn = {type: "Targeting", ac, targetingGroups, validTargetLists, stack}
  }

  startActivation(ac: AbilityContext): void {
    if (!this.canActivateAbility(ac)) {
      throw new RulesError("trying to activate non-activatable ability", ac)
    }
    //an activation isn't itself part of a trigger stack, so it resolves against an empty one -
    //but whatever it triggers absolutely is, which is why this hands off to resolveStackItem/queueTriggers
    //exactly like a stack item would.
    this.resolveStackItem(ac, [])
  }

  supplyTargets(targets: FinalizedTargets): void {
    //todo validate targets against waitingOn.validTargetLists
    if (this.waitingOn.type !== "Targeting") throw new RulesError("supplying targets while not waiting for them", this.waitingOn)
    const {ac, stack} = this.waitingOn
    this.resolveNow(ac, targets, stack)
  }

  applyEffect(ac: AbilityContext, targets: FinalizedTargets): AbilityContext[] {
    //returns triggers
    const atoms = this.buildEffectAtoms(ac, targets)
    this.applyEffectAtoms(atoms)
    this.log.push({type: "Effects", effectAtoms: atoms})
    const triggers = this.checkForTriggers(atoms)
    return triggers
  }

  //the single entrypoint for "some new triggers just appeared" - called after any effect
  //resolves and after any targets get supplied. Puts the new triggers on top of restOfStack
  //(the part of the stack that was already waiting underneath) and picks up resolution from there.
  queueTriggers(newTriggers: AbilityContext[], restOfStack: AbilityContext[]): void {
    //APNAP: the active player locks in their own order first, then each other player in turn
    //order does the same. placeNewTriggers walks this same list, but prepends each player's
    //block as it's settled - so the active player, asked first, still ends up at the *bottom*
    //of the resulting stack (they resolve last), same as if they'd been placed there directly.
    const askingOrder = this.priorityOrderFrom(this.turnPlayer)
    this.placeNewTriggers(askingOrder, [], newTriggers, restOfStack)
  }

  //full rotation of every player, starting from `start` and moving through priority order
  priorityOrderFrom(start: number): number[] {
    const order: number[] = []
    let player = start
    for (let i = 0; i < this.players.length; i++) {
      order.push(player)
      player = this.previousPlayer(player)
    }
    return order
  }

  //walks `remainingPlayers`, letting each one order their own simultaneous triggers among
  //`unplaced` before moving to the next player. Pauses on "Ordering triggers" only when a
  //player actually has a choice to make (2+ of their own triggers); a lone trigger needs no
  //ordering, so it's placed automatically and we move straight on to the next player.
  placeNewTriggers(remainingPlayers: number[], ordered: AbilityContext[], unplaced: AbilityContext[], stack: AbilityContext[]): void {
    if (unplaced.length === 0) {
      this.advanceStack([...ordered, ...stack])
      return
    }
    const [player, ...rest] = remainingPlayers
    const theirs = unplaced.filter(ac => ac.player === player)
    if (theirs.length <= 1) {
      //if zero or one triggers, they have nothing to order.
      //prepended, not appended: the player being asked right now ends up underneath
      //whoever gets asked after them, so the last player asked resolves first.
      this.placeNewTriggers(rest, [...theirs, ...ordered], unplaced.filter(ac => !theirs.includes(ac)), stack)
    } else {
      this.waitingOn = {
        type: "Ordering triggers",
        remainingPlayers: rest,
        ordered,
        toOrder: theirs,
        unplaced: unplaced.filter(ac => !theirs.includes(ac)),
        stack
      }
    }
  }

  //`order` must be all of waitingOn.toOrder, in the order that player wants them to resolve
  supplyTriggerOrder(order: AbilityContext[]): void {
    if (this.waitingOn.type !== "Ordering triggers") throw new RulesError("supplying trigger order while we're not waiting for it", this.waitingOn)
    //todo validate order (is it a permutation of waitingOn.toOrder, are they all triggers, etc.)
    const {remainingPlayers, ordered, unplaced, stack} = this.waitingOn
    //prepended, same reasoning as in placeNewTriggers
    this.placeNewTriggers(remainingPlayers, [...order, ...ordered], unplaced, stack)
  }

  //stack is fully ordered at this point - just work through it one item at a time.
  advanceStack(stack: AbilityContext[]): void {
    if (stack.length === 0) {
      this.waitingOn = {type: "Main", player: this.turnPlayer, options: this.getAllActivatableAbilities(this.turnPlayer)}
      return
    }
    const [ac, ...restOfStack] = stack
    if (ac!.ability.mandatory) {
      //mandatory, resolves without player input
      this.resolveStackItem(ac!, restOfStack)
    } else {
      this.waitingOn = {type: "Optional trigger", ac: ac!, stack: restOfStack}
    }
  }

  supplyOptionalTriggerChoice(use: boolean): void {
    if (this.waitingOn.type !== "Optional trigger") throw new RulesError("supplying optional trigger choice while not waiting for one", this.waitingOn)
    const {ac, stack} = this.waitingOn
    if (use) {
      this.resolveStackItem(ac, stack)
    } else {
      this.advanceStack(stack)
    }
  }

  //resolves ac right now if it can, or pauses for targets first. Shared by activations
  //(with an empty restOfStack) and by trigger resolution, since both cases are "resolve this
  //ability, then go figure out what to do with whatever it triggers."
  resolveStackItem(ac: AbilityContext, restOfStack: AbilityContext[]): void {
    if (ac.ability.targetingGroups.length > 0) {
      this.waitForTargets(ac, restOfStack)
    } else {
      this.resolveNow(ac, {}, restOfStack)
    }
  }

  //conditions are rechecked right as an ability would resolve - something else on the stack
  //may have already changed the board since this one triggered. If they no longer hold, the
  //ability just fizzles: no effect, but whatever's still waiting underneath carries on.
  //(a simplification of Magic's "intervening if" - we don't distinguish those from an
  //ability's other conditions, so we always recheck rather than only for that phrasing.)
  private resolveNow(ac: AbilityContext, targets: FinalizedTargets, restOfStack: AbilityContext[]): void {
    const conditionsStillMet = (ac.ability.conditions ?? []).every(cond => this.checkCondition(ac.player, ac.card, cond))
    if (conditionsStillMet) {
      const newTriggers = this.applyEffect(ac, targets)
      this.queueTriggers(newTriggers, restOfStack)
    } else {
      this.queueTriggers([], restOfStack)
    }
  }

  nextPlayer(n: number): number {
    //next in turn order
    //todo dead players?
    if (n > 0) return n - 1
    else return this.players.length - 1
  }

  previousPlayer(n: number): number {
    //previous in turn order, useful for priority
    //todo dead players?
    if (n === this.players.length - 1) return 0
    else return n + 1
  }

  checkForTriggers(atoms: EffectAtom[]): AbilityContext[] {
    //todo make this logic less... bad
    const triggerable: AbilityContext[] = []
    for (const atom of atoms) {
      for (const card of this.cards) {
        for (const ability of card.abilities) {
          if (ability.trigger.type === "Activated") continue
          else if (ability.trigger.type === "This moves") {
            if (atom.type === "Move" && atom.card === card && atom.to === ability.trigger.to) {
              triggerable.push({player: card.controlledBy, card, ability})
            }
          }
        }
      }
    }
    return triggerable
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

export type Trigger = {type: "Activated"} | {type: "This moves", from?: Zone, to: Zone}

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

export type AbilityContext = {player: number, card: Card, ability: Ability}
