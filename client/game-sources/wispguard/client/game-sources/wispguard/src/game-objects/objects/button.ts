import * as Phaser from 'phaser';
import { SwitchAction, TiledSwitchObject } from '../../common/tiled/types';
import { CustomGameObject } from '../../common/types';
import { SWITCH_TEXTURE } from '../../common/tiled/common';
import { ASSET_KEYS, BUTTON_FRAME_KEYS } from '../../common/assets';

type ButtonPressedEvent = {
  action: SwitchAction;
  targetIds: number[];
};

export class Button extends Phaser.Physics.Arcade.Image implements CustomGameObject {
  #switchTargetIds: number[];
  #switchAction: SwitchAction;

  constructor(scene: Phaser.Scene, config: TiledSwitchObject) {
    const frame =
      config.texture === SWITCH_TEXTURE.FLOOR ? BUTTON_FRAME_KEYS.FLOOR_SWITCH : BUTTON_FRAME_KEYS.PLATE_SWITCH;
    super(scene, config.x, config.y, ASSET_KEYS.DUNGEON_OBJECTS, frame);

    // add object to scene and enable phaser physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0, 1).setImmovable(true);

    this.#switchTargetIds = config.targetIds;
    this.#switchAction = config.action;

    // disable physics body and make game objects inactive/not visible
    this.disableObject();
  }

  public press(): ButtonPressedEvent {
    this.disableObject();

    // return data about button being pressed with metadata tied to action
    return {
      action: this.#switchAction,
      targetIds: this.#switchTargetIds,
    };
  }

  public disableObject(): void {
    // disable body on game object so we stop triggering the collision
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    // make not visible until player re-enters room
    this.active = false;
    this.visible = false;
  }

  public enableObject(): void {
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.active = true;
    this.visible = true;
  }
}
