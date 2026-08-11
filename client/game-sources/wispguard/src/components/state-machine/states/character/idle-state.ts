import { BaseCharacterState } from './base-character-state';
import { CHARACTER_STATES } from './character-states';
import { CharacterGameObject } from '../../../../game-objects/common/character-game-object';
import { HeldGameObjectComponent } from '../../../game-object/held-game-object-component';
import { ThrowableObjectComponent } from '../../../game-object/throwable-object-component';
import { CollidingObjectsComponent } from '../../../game-object/colliding-objects-component';
import { InteractiveObjectComponent } from '../../../game-object/interactive-object-component';
import { INTERACTIVE_OBJECT_TYPE } from '../../../../common/common';

export class IdleState extends BaseCharacterState {
  constructor(gameObject: CharacterGameObject) {
    super(CHARACTER_STATES.IDLE_STATE, gameObject);
  }

  public onEnter(): void {
    // play idle animation based on game object direction
    this._gameObject.animationComponent.playAnimation(`IDLE_${this._gameObject.direction}`);

    // reset game object velocity
    this._resetObjectVelocity();

    const heldComponent = HeldGameObjectComponent.getComponent<HeldGameObjectComponent>(this._gameObject);
    if (heldComponent !== undefined && heldComponent.object !== undefined) {
      const throwObjectComponent = ThrowableObjectComponent.getComponent<ThrowableObjectComponent>(
        heldComponent.object,
      );
      if (throwObjectComponent !== undefined) {
        throwObjectComponent.drop();
      }
      heldComponent.drop();
    }
  }

  public onUpdate(): void {
    const controls = this._gameObject.controls;

    if (controls.isMovementLocked) {
      return;
    }

    // Le jeu d'origine ne permettait d'interagir qu'en marchant. Autorise X
    // à l'arrêt pour ramasser un objet ou ouvrir le coffre placé devant soi.
    if (controls.isActionKeyJustDown) {
      const collisions = CollidingObjectsComponent.getComponent<CollidingObjectsComponent>(this._gameObject);
      const collisionObject = collisions?.objects[0];
      const interactive = collisionObject === undefined
        ? undefined
        : InteractiveObjectComponent.getComponent<InteractiveObjectComponent>(collisionObject);
      if (collisionObject !== undefined && interactive?.canInteractWith()) {
        interactive.interact();
        if (interactive.objectType === INTERACTIVE_OBJECT_TYPE.PICKUP) {
          this._stateMachine.setState(CHARACTER_STATES.LIFT_STATE, collisionObject);
          return;
        }
        if (interactive.objectType === INTERACTIVE_OBJECT_TYPE.OPEN) {
          this._stateMachine.setState(CHARACTER_STATES.OPEN_CHEST_STATE, collisionObject);
          return;
        }
      }
    }

    // if attack key was pressed, attack with weapon
    if (controls.isAttackKeyJustDown) {
      this._stateMachine.setState(CHARACTER_STATES.ATTACK_STATE);
      return;
    }

    // if no other input is provided, do nothing
    if (!controls.isDownDown && !controls.isUpDown && !controls.isLeftDown && !controls.isRightDown) {
      return;
    }

    this._stateMachine.setState(CHARACTER_STATES.MOVE_STATE);
  }
}
