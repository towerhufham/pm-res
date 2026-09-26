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
  state: "Building" | "Resolving" | "Adding Triggers" | "Completed"
  links: AbilityContext[]
  pendingTriggerPool: AbilityContext[]
  inOriginalChain: boolean
  passToPlayer: number
  consecutivePasses: number

  constructor(game: GameState, link1: AbilityContext) {
    this.game = game
    this.state = "Building"
    this.links = [link1]
    this.pendingTriggerPool = []
    this.inOriginalChain = true
    this.passToPlayer = link1.player
    this.consecutivePasses = 0
  }

  playerResponds(ac: AbilityContext) {
    this.links.push(ac)
    this.consecutivePasses = 0
    if (this.inOriginalChain) {
      this.passToPlayer = ac.player
    }
    //todo add cost triggers to pool
  }

  playerPasses() {
    this.consecutivePasses += 1
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
    //let this.game resolve it
    //add triggers to pool
    this.tryResolve()
  }

  tryEndChain() {
    if (this.pendingTriggerPool.length > 0) {
      this.state = "Adding Triggers"
      this.inOriginalChain = false
      this.consecutivePasses = 0
      this.tryAddTriggers()
    } else {
      this.state = "Completed"
    }
  }

  tryAddTriggers() {
    
  }
}