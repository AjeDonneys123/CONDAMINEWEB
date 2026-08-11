import * as Phaser from 'phaser';
import { ASSET_KEYS, CHEST_FRAME_KEYS } from '../../common/assets';
import { CHEST_STATE, INTERACTIVE_OBJECT_TYPE, LEVEL_NAME } from '../../common/common';
import { ChestState, CustomGameObject } from '../../common/types';
import { InteractiveObjectComponent } from '../../components/game-object/interactive-object-component';
import { ChestReward, TiledChestObject, TrapType } from '../../common/tiled/types';
import { TRAP_TYPE } from '../../common/tiled/common';
import { InventoryManager } from '../../components/inventory/inventory-manager';
import { DataManager } from '../../common/data-manager';

export class Chest extends Phaser.Physics.Arcade.Image implements CustomGameObject {
  #state: ChestState;
  #isBossKeyChest: boolean;
  #id: number;
  #revealTrigger: TrapType;
  #contents: ChestReward;

  constructor(scene: Phaser.Scene, config: TiledChestObject, chestState = CHEST_STATE.HIDDEN) {
    const frameKey = config.requiresBossKey ? CHEST_FRAME_KEYS.BIG_CHEST_CLOSED : CHEST_FRAME_KEYS.SMALL_CHEST_CLOSED;
    super(scene, config.x, config.y, ASSET_KEYS.DUNGEON_OBJECTS, frameKey);

    // add object to scene and enable phaser physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0, 1).setImmovable(true);

    this.#state = chestState;
    this.#isBossKeyChest = config.requiresBossKey;
    this.#id = config.id;
    this.#revealTrigger = config.revealChestTrigger;
    this.#contents = config.contents;

    if (this.#isBossKeyChest) {
      (this.body as Phaser.Physics.Arcade.Body).setSize(32, 24).setOffset(0, 8);
    }

    // add components
    new InteractiveObjectComponent(
      this,
      INTERACTIVE_OBJECT_TYPE.OPEN,
      () => {
        // if this is a small chest, then the player can open
        if (!this.#isBossKeyChest) {
          return true;
        }
        // use area information from data manager
        if (!InventoryManager.instance.getAreaInventory(DataManager.instance.data.currentArea.name).bossKey) {
          return false;
        }
        return true;
      },
      () => {
        this.open();
      },
    );

    if (this.#revealTrigger === TRAP_TYPE.NONE) {
      if (this.#state === CHEST_STATE.HIDDEN) {
        this.#state = CHEST_STATE.REVEALED;
      }
      return;
    }
    // disable physics body and make game objects inactive/not visible
    this.disableObject();
  }

  get revealTrigger(): TrapType {
    return this.#revealTrigger;
  }

  get id(): number {
    return this.#id;
  }

  get contents(): ChestReward {
    return this.#contents;
  }

  public open(): void {
    if (this.#state !== CHEST_STATE.REVEALED) {
      return;
    }

    this.#state = CHEST_STATE.OPEN;
    const frameKey = this.#isBossKeyChest ? CHEST_FRAME_KEYS.BIG_CHEST_OPEN : CHEST_FRAME_KEYS.SMALL_CHEST_OPEN;
    this.setFrame(frameKey);

    // after we open the chest, we can no longer interact with it
    InteractiveObjectComponent.removeComponent(this);
  }

  public disableObject(): void {
    // disable body on game object so we stop triggering the collision
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    // make not visible until player re-enters room
    this.active = false;
    this.visible = false;
  }

  public enableObject(): void {
    if (this.#state === CHEST_STATE.HIDDEN) {
      return;
    }

    // enable body on game object so we trigger the collision
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    // make visible to the player
    this.active = true;
    this.visible = true;
  }

  public reveal(): void {
    if (this.#state !== CHEST_STATE.HIDDEN) {
      return;
    }
    this.#state = CHEST_STATE.REVEALED;
    this.enableObject();
  }
}
