import * as Phaser from 'phaser';
import { CharacterGameObject } from '../../../../../../game-objects/common/character-game-object';
import { BaseCharacterState } from '../../base-character-state';
import { CHARACTER_STATES } from '../../character-states';
import {
  ENEMY_BOSS_TELEPORT_STATE_FINISHED_DELAY,
  ENEMY_BOSS_TELEPORT_STATE_INITIAL_DELAY,
} from '../../../../../../common/config';
import { DIRECTION } from '../../../../../../common/common';

export class BossDrowTeleportState extends BaseCharacterState {
  #possibleTeleportLocations: Phaser.Math.Vector2[];

  constructor(gameObject: CharacterGameObject, possibleTeleportLocations: Phaser.Math.Vector2[]) {
    super(CHARACTER_STATES.TELEPORT_STATE, gameObject);
    this.#possibleTeleportLocations = possibleTeleportLocations;
  }

  public onEnter(): void {
    this._gameObject.invulnerableComponent.invulnerable = true;

    const timeEvent = this._gameObject.scene.time.addEvent({
      delay: ENEMY_BOSS_TELEPORT_STATE_INITIAL_DELAY,
      callback: () => {
        if (timeEvent.getOverallProgress() === 1) {
          this.#handleTeleportFinished();
          return;
        }
        this._gameObject.direction = DIRECTION.DOWN;
        this._gameObject.animationComponent.playAnimation(`IDLE_${this._gameObject.direction}`);
        const location =
          this.#possibleTeleportLocations[timeEvent.repeatCount % this.#possibleTeleportLocations.length];
        this._gameObject.setPosition(location.x, location.y);
      },
      callbackScope: this,
      repeat: this.#possibleTeleportLocations.length * 3 - 1,
    });
  }

  #handleTeleportFinished(): void {
    this._gameObject.visible = false;
    this._gameObject.scene.time.delayedCall(ENEMY_BOSS_TELEPORT_STATE_FINISHED_DELAY, () => {
      const randomLocation = Phaser.Utils.Array.GetRandom(this.#possibleTeleportLocations);
      this._gameObject.setPosition(randomLocation.x, randomLocation.y);
      this._gameObject.visible = true;
      this._gameObject.invulnerableComponent.invulnerable = false;
      this._stateMachine.setState(CHARACTER_STATES.PREPARE_ATTACK_STATE);
    });
  }
}
