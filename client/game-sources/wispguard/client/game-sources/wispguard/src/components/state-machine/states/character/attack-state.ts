import { DIRECTION } from '../../../../common/common';
import { exhaustiveGuard } from '../../../../common/utils';
import { CharacterGameObject } from '../../../../game-objects/common/character-game-object';
import { WeaponComponent } from '../../../game-object/weapon-component';
import { BaseCharacterState } from './base-character-state';
import { CHARACTER_STATES } from './character-states';

export class AttackState extends BaseCharacterState {
  constructor(gameObject: CharacterGameObject) {
    super(CHARACTER_STATES.ATTACK_STATE, gameObject);
  }

  public onEnter(): void {
    // reset game object velocity
    this._resetObjectVelocity();

    const weaponComponent = WeaponComponent.getComponent<WeaponComponent>(this._gameObject);
    if (weaponComponent === undefined || weaponComponent.weapon === undefined) {
      this._stateMachine.setState(CHARACTER_STATES.IDLE_STATE);
      return;
    }

    const weapon = weaponComponent.weapon;
    switch (this._gameObject.direction) {
      case DIRECTION.UP:
        return weapon.attackUp();
      case DIRECTION.DOWN:
        return weapon.attackDown();
      case DIRECTION.LEFT:
        return weapon.attackLeft();
      case DIRECTION.RIGHT:
        return weapon.attackRight();
      default:
        exhaustiveGuard(this._gameObject.direction);
    }
  }

  public onUpdate(): void {
    const weaponComponent = WeaponComponent.getComponent<WeaponComponent>(this._gameObject);
    if (weaponComponent === undefined || weaponComponent.weapon === undefined) {
      this._stateMachine.setState(CHARACTER_STATES.IDLE_STATE);
      return;
    }
    // wait until weapon animation is done for attacking
    const weapon = weaponComponent.weapon;
    if (weapon.isAttacking) {
      return;
    }
    this._stateMachine.setState(CHARACTER_STATES.IDLE_STATE);
  }
}
