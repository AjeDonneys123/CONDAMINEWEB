import { CharacterGameObject } from '../../../../../../game-objects/common/character-game-object';
import { BaseCharacterState } from '../../base-character-state';
import { CHARACTER_STATES } from '../../character-states';
import { ENEMY_BOSS_IDLE_STATE_DURATION } from '../../../../../../common/config';

export class BossDrowIdleState extends BaseCharacterState {
  constructor(gameObject: CharacterGameObject) {
    super(CHARACTER_STATES.IDLE_STATE, gameObject);
  }

  public onEnter(): void {
    // play idle animation based on game object direction
    this._gameObject.animationComponent.playAnimation(`IDLE_${this._gameObject.direction}`);

    // wait a brief period of time before showing game object and then transition to teleport
    this._gameObject.scene.time.delayedCall(ENEMY_BOSS_IDLE_STATE_DURATION, () => {
      if (this._stateMachine.currentStateName === CHARACTER_STATES.IDLE_STATE) {
        this._stateMachine.setState(CHARACTER_STATES.TELEPORT_STATE);
      }
    });
  }
}
