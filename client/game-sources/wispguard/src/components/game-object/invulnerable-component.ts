import { GameObject } from '../../common/types';
import { BaseGameObjectComponent } from './base-game-object-component';

export class InvulnerableComponent extends BaseGameObjectComponent {
  #invulnerable: boolean;
  #invulnerableAfterHitAnimationDuration: number;

  constructor(gameObject: GameObject, invulnerable = false, invulnerableAfterHitAnimationDuration = 0) {
    super(gameObject);
    this.#invulnerable = invulnerable;
    this.#invulnerableAfterHitAnimationDuration = invulnerableAfterHitAnimationDuration;
  }

  get invulnerable(): boolean {
    return this.#invulnerable;
  }

  set invulnerable(val: boolean) {
    this.#invulnerable = val;
  }

  get invulnerableAfterHitAnimationDuration(): number {
    return this.#invulnerableAfterHitAnimationDuration;
  }
}
