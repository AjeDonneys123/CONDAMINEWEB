import * as Phaser from 'phaser';
import { ASSET_KEYS, DROW_ANIMATION_KEYS } from '../../../common/assets';
import {
  ENEMY_BOSS_DROW_SPEED,
  ENEMY_BOSS_DROW_MAX_HEALTH,
  BOSS_HURT_PUSH_BACK_DELAY,
  ENEMY_BOSS_DROW_DEATH_ANIMATION_DURATION,
  ENEMY_BOSS_START_INITIAL_DELAY,
  ENEMY_BOSS_ATTACK_DAMAGE,
  ENEMY_BOSS_ATTACK_SPEED,
} from '../../../common/config';
import { Position } from '../../../common/types';
import { AnimationConfig } from '../../../components/game-object/animation-component';
import { InputComponent } from '../../../components/input/input-component';
import { CHARACTER_STATES } from '../../../components/state-machine/states/character/character-states';
import { CharacterGameObject } from '../../common/character-game-object';
import { WeaponComponent } from '../../../components/game-object/weapon-component';
import { HurtState } from '../../../components/state-machine/states/character/hurt-state';
import { DeathState } from '../../../components/state-machine/states/character/death-state';
import { flash } from '../../../common/juice-utils';
import { BossDrowHiddenState } from '../../../components/state-machine/states/character/boss/drow/boss-drow-hidden-state';
import { BossDrowPrepareAttackState } from '../../../components/state-machine/states/character/boss/drow/boss-drow-prepare-attack-state';
import { BossDrowTeleportState } from '../../../components/state-machine/states/character/boss/drow/boss-drow-teleport-state';
import { AttackState } from '../../../components/state-machine/states/character/attack-state';
import { BossDrowIdleState } from '../../../components/state-machine/states/character/boss/drow/boss-drow-idle-state';
import { Dagger } from '../../weapons/dagger';
import { CUSTOM_EVENTS, EVENT_BUS } from '../../../common/event-bus';

type DrowConfig = {
  scene: Phaser.Scene;
  position: Position;
};

export class Drow extends CharacterGameObject {
  #weaponComponent: WeaponComponent;

  constructor(config: DrowConfig) {
    // create animation config for component
    const hurtAnimConfig = { key: DROW_ANIMATION_KEYS.HIT, repeat: 0, ignoreIfPlaying: true };
    const animationConfig: AnimationConfig = {
      WALK_DOWN: { key: DROW_ANIMATION_KEYS.WALK_DOWN, repeat: -1, ignoreIfPlaying: true },
      WALK_UP: { key: DROW_ANIMATION_KEYS.WALK_UP, repeat: -1, ignoreIfPlaying: true },
      WALK_LEFT: { key: DROW_ANIMATION_KEYS.WALK_LEFT, repeat: -1, ignoreIfPlaying: true },
      WALK_RIGHT: { key: DROW_ANIMATION_KEYS.WALK_RIGHT, repeat: -1, ignoreIfPlaying: true },
      HURT_DOWN: hurtAnimConfig,
      HURT_UP: hurtAnimConfig,
      HURT_LEFT: hurtAnimConfig,
      HURT_RIGHT: hurtAnimConfig,
      IDLE_DOWN: { key: DROW_ANIMATION_KEYS.IDLE_DOWN, repeat: -1, ignoreIfPlaying: true },
      IDLE_UP: { key: DROW_ANIMATION_KEYS.IDLE_UP, repeat: -1, ignoreIfPlaying: true },
      IDLE_LEFT: { key: DROW_ANIMATION_KEYS.IDLE_SIDE, repeat: -1, ignoreIfPlaying: true },
      IDLE_RIGHT: { key: DROW_ANIMATION_KEYS.IDLE_SIDE, repeat: -1, ignoreIfPlaying: true },
    };

    super({
      scene: config.scene,
      position: config.position,
      assetKey: ASSET_KEYS.DROW,
      frame: 0,
      id: `drow-${Phaser.Math.RND.uuid()}`,
      isPlayer: false,
      animationConfig,
      speed: ENEMY_BOSS_DROW_SPEED,
      inputComponent: new InputComponent(),
      isInvulnerable: false,
      maxLife: ENEMY_BOSS_DROW_MAX_HEALTH,
    });

    this.#weaponComponent = new WeaponComponent(this);
    this.#weaponComponent.weapon = new Dagger(
      this,
      this.#weaponComponent,
      {
        DOWN: DROW_ANIMATION_KEYS.ATTACK_DOWN,
        UP: DROW_ANIMATION_KEYS.ATTACK_UP,
        LEFT: DROW_ANIMATION_KEYS.ATTACK_SIDE,
        RIGHT: DROW_ANIMATION_KEYS.ATTACK_SIDE,
      },
      ENEMY_BOSS_ATTACK_DAMAGE,
      ENEMY_BOSS_ATTACK_SPEED,
    );

    // add state machine
    this._stateMachine.addState(new BossDrowIdleState(this));
    this._stateMachine.addState(new BossDrowHiddenState(this));
    this._stateMachine.addState(new BossDrowPrepareAttackState(this));
    this._stateMachine.addState(
      new BossDrowTeleportState(this, [
        new Phaser.Math.Vector2(this.scene.scale.width / 2, 80),
        new Phaser.Math.Vector2(64, 180),
        new Phaser.Math.Vector2(192, 180),
      ]),
    );
    this._stateMachine.addState(new AttackState(this));
    this._stateMachine.addState(
      new HurtState(this, BOSS_HURT_PUSH_BACK_DELAY, undefined, CHARACTER_STATES.TELEPORT_STATE),
    );
    this._stateMachine.addState(
      new DeathState(this, () => {
        this.visible = true;
        flash(this, () => {
          const fx = this.postFX.addWipe(0.1, 0, 1);
          this.scene.add.tween({
            targets: fx,
            progress: 1,
            duration: ENEMY_BOSS_DROW_DEATH_ANIMATION_DURATION,
            onComplete: () => {
              this.visible = false;
              EVENT_BUS.emit(CUSTOM_EVENTS.BOSS_DEFEATED);
            },
          });
        });
      }),
    );

    this.setScale(1.25);
    this.physicsBody.setSize(12, 24, true).setOffset(this.displayWidth / 4, this.displayHeight / 4 - 3);
  }

  get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  public update(): void {
    super.update();
    this.#weaponComponent.update();
  }

  public enableObject(): void {
    super.enableObject();

    if (this._isDefeated) {
      return;
    }

    if (this._stateMachine.currentStateName === undefined) {
      this.visible = false;
      this.scene.time.delayedCall(ENEMY_BOSS_START_INITIAL_DELAY, () => {
        this.visible = true;
        this._stateMachine.setState(CHARACTER_STATES.HIDDEN_STATE);
      });
    }
  }
}
