import { Direction } from '../../common/types';
import { WeaponComponent } from '../../components/game-object/weapon-component';

export interface Weapon {
  baseDamage: number;
  isAttacking: boolean;
  attackUp(): void;
  attackDown(): void;
  attackRight(): void;
  attackLeft(): void;
  update(): void;
  onCollisionCallback(): void;
}

export type WeaponAttackAnimationConfig = {
  [key in Direction]: string;
};

export abstract class BaseWeapon implements Weapon {
  protected _weaponComponent: WeaponComponent;
  protected _attacking: boolean;
  protected _sprite: Phaser.GameObjects.Sprite;
  protected _attackAnimationConfig: WeaponAttackAnimationConfig;
  protected _baseDamage: number;

  constructor(
    sprite: Phaser.GameObjects.Sprite,
    weaponComponent: WeaponComponent,
    animationConfig: WeaponAttackAnimationConfig,
    baseDamage: number,
  ) {
    this._sprite = sprite;
    this._weaponComponent = weaponComponent;
    this._attackAnimationConfig = animationConfig;
    this._baseDamage = baseDamage;
    this._attacking = false;
  }

  get isAttacking(): boolean {
    return this._attacking;
  }

  get baseDamage(): number {
    return this._baseDamage;
  }

  protected attack(direction: Direction): void {
    const attackAnimationKey = this._attackAnimationConfig[direction];
    this._attacking = true;
    this._sprite.play({ key: attackAnimationKey, repeat: 0 }, true);
    this._weaponComponent.body.enable = true;
    this._sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + attackAnimationKey, () => {
      this.attackAnimationCompleteHandler();
    });
  }

  protected attackAnimationCompleteHandler(): void {
    this._attacking = false;
    this._weaponComponent.body.enable = false;
  }

  // following methods must be implemented by weapon implementations
  public abstract attackUp(): void;

  public abstract attackDown(): void;

  public abstract attackRight(): void;

  public abstract attackLeft(): void;

  // following methods to be overridden if needed by weapon implementations
  public update(): void {
    // not implemented
  }

  public onCollisionCallback(): void {
    // not implemented
  }
}
