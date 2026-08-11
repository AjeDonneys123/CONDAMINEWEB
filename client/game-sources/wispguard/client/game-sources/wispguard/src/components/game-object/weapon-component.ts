import { GameObject } from '../../common/types';
import { Weapon } from '../../game-objects/weapons/base-weapon';
import { BaseGameObjectComponent } from './base-game-object-component';

export class WeaponComponent extends BaseGameObjectComponent {
  #weapon: Weapon | undefined;
  #weaponPhysicsBody: Phaser.Physics.Arcade.Body;

  constructor(gameObject: GameObject) {
    super(gameObject);
    this.#weaponPhysicsBody = gameObject.scene.physics.add.body(gameObject.x, gameObject.y, 1, 1);
    this.#weaponPhysicsBody.enable = false;
    this.assignComponentToObject(this.#weaponPhysicsBody);
  }

  get weapon(): Weapon | undefined {
    return this.#weapon;
  }

  set weapon(weapon: Weapon | undefined) {
    this.#weapon = weapon;
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.#weaponPhysicsBody;
  }

  get weaponDamage(): number {
    if (this.#weapon === undefined) {
      return 0;
    }
    return this.#weapon.baseDamage;
  }

  public update(): void {
    if (this.#weapon === undefined) {
      return;
    }
    this.#weapon.update();
  }
}
