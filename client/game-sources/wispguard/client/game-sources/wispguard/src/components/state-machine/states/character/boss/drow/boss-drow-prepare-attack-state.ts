import * as Phaser from 'phaser';
import { DIRECTION } from '../../../../../../common/common';
import { CharacterGameObject } from '../../../../../../game-objects/common/character-game-object';
import { GameScene } from '../../../../../../scenes/game-scene';
import { BaseCharacterState } from '../../base-character-state';
import { CHARACTER_STATES } from '../../character-states';
import { ENEMY_BOSS_PREPARE_ATTACK_STATE_FINISHED_DELAY } from '../../../../../../common/config';

export class BossDrowPrepareAttackState extends BaseCharacterState {
  constructor(gameObject: CharacterGameObject) {
    super(CHARACTER_STATES.PREPARE_ATTACK_STATE, gameObject);
  }

  public onEnter(): void {
    const targetEnemy = (this._gameObject.scene as GameScene).player;

    const vec = new Phaser.Math.Vector2(targetEnemy.x - this._gameObject.x, targetEnemy.y - this._gameObject.y);
    const radians = vec.angle();
    const degrees = Phaser.Math.RadToDeg(radians);

    this._gameObject.setFlipX(false);
    if (degrees >= 45 && degrees < 135) {
      this._gameObject.direction = DIRECTION.DOWN;
    } else if (degrees >= 135 && degrees < 225) {
      this._gameObject.setFlipX(true);
      this._gameObject.direction = DIRECTION.LEFT;
    } else if (degrees >= 225 && degrees < 315) {
      this._gameObject.direction = DIRECTION.UP;
    } else {
      this._gameObject.direction = DIRECTION.RIGHT;
    }

    if (this._gameObject.direction === DIRECTION.DOWN || this._gameObject.direction === DIRECTION.UP) {
      this._gameObject.setX(targetEnemy.x);
    } else {
      this._gameObject.setY(targetEnemy.y);
    }

    this._gameObject.animationComponent.playAnimation(`IDLE_${this._gameObject.direction}`);
    this._gameObject.scene.time.delayedCall(ENEMY_BOSS_PREPARE_ATTACK_STATE_FINISHED_DELAY, () => {
      this._stateMachine.setState(CHARACTER_STATES.ATTACK_STATE);
    });
  }
}
