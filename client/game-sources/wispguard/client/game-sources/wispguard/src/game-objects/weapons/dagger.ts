import { BaseWeapon, WeaponAttackAnimationConfig } from './base-weapon';
import { DIRECTION } from '../../common/common';
import { WeaponComponent } from '../../components/game-object/weapon-component';
import { ASSET_KEYS } from '../../common/assets';

export class Dagger extends BaseWeapon {
  #weaponSprite: Phaser.GameObjects.Sprite;
  #weaponSpeed: number;

  constructor(
    sprite: Phaser.GameObjects.Sprite,
    weaponComponent: WeaponComponent,
    animationConfig: WeaponAttackAnimationConfig,
    baseDamage: number,
    weaponSpeed: number,
  ) {
    super(sprite, weaponComponent, animationConfig, baseDamage);

    this.#weaponSprite = sprite.scene.add
      .sprite(0, 0, ASSET_KEYS.DAGGER, 0)
      .setVisible(false)
      .setOrigin(0, 1)
      .play(ASSET_KEYS.DAGGER);
    this.#weaponSpeed = weaponSpeed;
    this._weaponComponent.body.setSize(this.#weaponSprite.width, this.#weaponSprite.height);
  }

  public attackUp(): void {
    this._weaponComponent.body.position.set(this._sprite.x - 8, this._sprite.y - 25);
    this._weaponComponent.body.setVelocityY(this.#weaponSpeed * -1);
    this.#weaponSprite
      .setPosition(this._weaponComponent.body.position.x, this._weaponComponent.body.y)
      .setVisible(true)
      .setOrigin(0, 0)
      .setAngle(0)
      .setFlipY(false);
    this.attack(DIRECTION.UP);
  }

  public attackDown(): void {
    this._weaponComponent.body.position.set(this._sprite.x - 7, this._sprite.y + 20);
    this._weaponComponent.body.setVelocityY(this.#weaponSpeed);
    this.#weaponSprite
      .setPosition(this._weaponComponent.body.position.x, this._weaponComponent.body.y)
      .setVisible(true)
      .setOrigin(1, 1)
      .setAngle(180)
      .setFlipY(false);
    this.attack(DIRECTION.DOWN);
  }

  public attackRight(): void {
    this._weaponComponent.body.position.set(this._sprite.x + 10, this._sprite.y - 5);
    this._weaponComponent.body.setVelocityX(this.#weaponSpeed);
    this.#weaponSprite
      .setPosition(this._weaponComponent.body.position.x, this._weaponComponent.body.y)
      .setVisible(true)
      .setOrigin(0, 1)
      .setAngle(90)
      .setFlipY(false);
    this.attack(DIRECTION.RIGHT);
  }

  public attackLeft(): void {
    this._weaponComponent.body.position.set(this._sprite.x - 25, this._sprite.y - 5);
    this._weaponComponent.body.setVelocityX(this.#weaponSpeed * -1);
    this.#weaponSprite
      .setPosition(this._weaponComponent.body.position.x, this._weaponComponent.body.y)
      .setVisible(true)
      .setOrigin(0, 1)
      .setAngle(90)
      .setFlipY(true);
    this.attack(DIRECTION.LEFT);
  }

  public update(): void {
    this.#weaponSprite.setPosition(this._weaponComponent.body.position.x, this._weaponComponent.body.position.y);
  }

  protected attackAnimationCompleteHandler(): void {
    super.attackAnimationCompleteHandler();
    this.#weaponSprite.setVisible(false);
    this._weaponComponent.body.setVelocityX(0);
    this._weaponComponent.body.setVelocityY(0);
  }

  public onCollisionCallback(): void {
    this.attackAnimationCompleteHandler();
  }
}
