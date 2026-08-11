import { BaseWeapon } from './base-weapon';
import { DIRECTION } from '../../common/common';

export class Sword extends BaseWeapon {
  public attackUp(): void {
    this._weaponComponent.body.setSize(30, 18);
    this._weaponComponent.body.position.set(this._sprite.x - 16, this._sprite.y - 22);
    this.attack(DIRECTION.UP);
  }

  public attackDown(): void {
    this._weaponComponent.body.setSize(30, 18);
    if (this._sprite.flipX) {
      this._weaponComponent.body.position.set(this._sprite.x - 20, this._sprite.y + 10);
    } else {
      this._weaponComponent.body.position.set(this._sprite.x - 10, this._sprite.y + 10);
    }
    this.attack(DIRECTION.DOWN);
  }

  public attackRight(): void {
    this._weaponComponent.body.setSize(18, 30);
    this._weaponComponent.body.position.set(this._sprite.x + 10, this._sprite.y - 10);
    this.attack(DIRECTION.RIGHT);
  }

  public attackLeft(): void {
    this._weaponComponent.body.setSize(18, 30);
    this._weaponComponent.body.position.set(this._sprite.x - 30, this._sprite.y - 10);
    this.attack(DIRECTION.LEFT);
  }
}
