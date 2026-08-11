import { BaseCharacterState } from './base-character-state';
import { CHARACTER_STATES } from './character-states';
import { CharacterGameObject } from '../../../../game-objects/common/character-game-object';
import { Chest } from '../../../../game-objects/objects/chest';
import { CUSTOM_EVENTS, EVENT_BUS } from '../../../../common/event-bus';

export class OpenChestState extends BaseCharacterState {
  constructor(gameObject: CharacterGameObject) {
    super(CHARACTER_STATES.OPEN_CHEST_STATE, gameObject);
  }

  onEnter(args: unknown[]): void {
    const chest = args[0] as Chest;

    // make character invulnerable so we can collect the item
    this._gameObject.invulnerableComponent.invulnerable = true;

    // reset game object velocity
    this._resetObjectVelocity();

    // play lift animation based on game object direction
    this._gameObject.animationComponent.playAnimation(`LIFT_${this._gameObject.direction}`, () => {
      // emit event data regarding chest
      EVENT_BUS.emit(CUSTOM_EVENTS.OPENED_CHEST, chest);
      // after showing message to player, transition to idle state
      EVENT_BUS.once(CUSTOM_EVENTS.DIALOG_CLOSED, () => {
        // make character vulnerable so we can take damage
        this._gameObject.invulnerableComponent.invulnerable = false;
        this._stateMachine.setState(CHARACTER_STATES.IDLE_STATE);
      });
    });
  }
}
