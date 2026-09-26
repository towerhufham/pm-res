import { RulesError } from "./core"
import type { AbilityContext, GameState } from "./core"

// export type ChainState = {
//   type: "Response Window",
//   player: number
// } | {
//   type: ""
// }

export class Chain {
  game: GameState
  state: "Building" | "Resolving" | "Ordering triggers" | "Completed"
  links: AbilityContext[]
  pendingTriggerPool: AbilityContext[]
  inOriginalChain: boolean
  consecutivePasses: number
  playerWithPriority: number
  playerLastInOriginalChain: number

  constructor(game: GameState, link1: AbilityContext) {
    this.game = game
    this.state = "Building"
    this.links = [link1]
    this.pendingTriggerPool = []
    this.inOriginalChain = true
    this.consecutivePasses = 0
    this.playerWithPriority = link1.player
    this.playerLastInOriginalChain = link1.player
  }

  playerResponds(ac: AbilityContext) {
    //todo make sure this is the player with priority
    //you can only respond with a reactor (quick effect) i think??
    this.links.push(ac)
    this.consecutivePasses = 0
    if (this.inOriginalChain) {
      this.playerLastInOriginalChain = ac.player
    }
    //todo costs
  }

  playerPasses() {
    //todo make sure this is the player with priority
    this.consecutivePasses += 1
    this.playerWithPriority = this.game.nextPlayer(this.playerWithPriority)
    if (this.consecutivePasses >= this.game.players.length) {
      this.state = "Resolving"
      if (this.links.length > 0) {
        this.tryResolve()
      } else {
        this.state = "Completed"
      }
    }
  }

  tryResolve() {
    if (this.state !== "Resolving") throw new RulesError("calling tryResolve() but chain state is", this.state)
    //todo: effect-level choice ("choose" instead of "target")
    const link = this.links.pop()
    if (!link) {
      this.tryEndChain()
      return
    }
    const atoms = this.game.buildEffectAtoms(link)
    this.game.applyEffectAtoms(atoms)
    const newTriggers = this.game.checkForTriggers(atoms)
    this.pendingTriggerPool = [...this.pendingTriggerPool, ...newTriggers]
    this.tryResolve()
  }

  tryEndChain() {
    if (this.pendingTriggerPool.length > 0) {
      this.inOriginalChain = false
      this.consecutivePasses = 0
      this.playerWithPriority = this.game.turnPlayer
      this.tryOrderingTriggers()
    } else {
      this.state = "Completed"
    }
  }
  
  tryOrderingTriggers() {
    this.state = "Ordering triggers"
    if (this.pendingTriggerPool.length === 0) {
      this.state = "Building"
      return
    }
    const priorityTriggers = this.pendingTriggerPool.filter(ac => ac.player === this.playerWithPriority)
    if (priorityTriggers.length === 0) {
      //no triggers, nothing for player to do
      this.playerWithPriority = this.game.nextPlayer(this.playerWithPriority)
      this.tryOrderingTriggers()
    } else if (
      priorityTriggers.length === 1 
      && priorityTriggers[0]!.ability.mandatory
      && priorityTriggers[0]!.ability.targetingGroups.length === 0
    ) {
      //this very specific case also has nothing to do
      this.playerBatchTriggers(this.playerWithPriority, [priorityTriggers[0]!])
    }
    //else we need playerBatchTriggers() called externally
  }
  
  playerBatchTriggers(player: number, accepted: AbilityContext[]) {
    //we expect accepted to be in order and to have targets
    //anything of the player's that isn't here is considered rejected
    //todo validation
    this.links = [...this.links, ...accepted]
    this.pendingTriggerPool = this.pendingTriggerPool.filter(ac => ac.player !== player)
    this.playerWithPriority = this.game.nextPlayer(this.playerWithPriority)
    this.tryOrderingTriggers()
  }
}