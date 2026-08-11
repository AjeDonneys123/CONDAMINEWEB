import { ASSET_KEYS, DOOR_FRAME_KEYS } from '../../common/assets';
import { DIRECTION } from '../../common/common';
import { ENABLE_DEBUG_ZONE_AREA } from '../../common/config';
import { DOOR_TYPE } from '../../common/tiled/common';
import { DoorType, TiledDoorObject, TrapType } from '../../common/tiled/types';
import { CustomGameObject, Direction } from '../../common/types';

export class Door implements CustomGameObject {
  #scene: Phaser.Scene;
  #roomId: number;
  #targetDoorId: number;
  #targetRoomId: number;
  #x: number;
  #y: number;
  #targetLevel: string;
  #doorTransitionZone: Phaser.GameObjects.Zone;
  // eslint-disable-next-line no-unused-private-class-members
  #debugDoorTransitionZone: Phaser.GameObjects.Rectangle | undefined;
  #direction: Direction;
  #id: number;
  #isUnlocked: boolean;
  #doorObject!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody | undefined;
  #trapDoorTrigger: TrapType;
  #doorType: DoorType;

  constructor(scene: Phaser.Scene, config: TiledDoorObject, roomId: number) {
    this.#scene = scene;
    this.#id = config.id;
    this.#roomId = roomId;
    this.#targetDoorId = config.targetDoorId;
    this.#targetRoomId = config.targetRoomId;
    this.#targetLevel = config.targetLevel;
    this.#x = config.x;
    this.#y = config.y;
    this.#direction = config.direction;
    this.#doorType = config.doorType;
    this.#isUnlocked = config.isUnlocked;
    this.#trapDoorTrigger = config.trapDoorTrigger;

    // create door transition
    this.#doorTransitionZone = this.#scene.add
      .zone(config.x, config.y, config.width, config.height)
      .setOrigin(0, 1)
      .setName(config.id.toString(10));
    this.#scene.physics.world.enable(this.#doorTransitionZone);

    if (ENABLE_DEBUG_ZONE_AREA) {
      this.#debugDoorTransitionZone = this.#scene.add
        .rectangle(
          this.#doorTransitionZone.x,
          this.#doorTransitionZone.y,
          this.#doorTransitionZone.width,
          this.#doorTransitionZone.height,
          0xffff00,
          0.6,
        )
        .setOrigin(0, 1);
    }

    // if door is not open type create sprite for the door
    if (this.#doorType !== DOOR_TYPE.OPEN && this.#doorType !== DOOR_TYPE.OPEN_ENTRANCE) {
      const frameName = DOOR_FRAME_KEYS[`${this.#doorType}_${this.#direction}`];

      const door = this.#scene.physics.add
        .image(this.#x, this.y, ASSET_KEYS.DUNGEON_OBJECTS, frameName)
        .setImmovable(true)
        .setName(config.id.toString(10));

      switch (this.#direction) {
        case DIRECTION.UP:
          door.setOrigin(0, 0.5);
          break;
        case DIRECTION.DOWN:
          door.setOrigin(0, 0.75);
          break;
        case DIRECTION.LEFT:
          door.setOrigin(0.25, 1);
          break;
        case DIRECTION.RIGHT:
          door.setOrigin(0.5, 1);
          break;
      }

      this.#doorObject = door;
    }

    // disable physics body and make game objects inactive/not visible
    this.disableObject();
  }

  get x(): number {
    return this.#x;
  }

  get y(): number {
    return this.#y;
  }

  get roomId(): number {
    return this.#roomId;
  }

  get targetRoomId(): number {
    return this.#targetRoomId;
  }

  get targetDoorId(): number {
    return this.#targetDoorId;
  }

  get doorTransitionZone(): Phaser.GameObjects.Zone {
    return this.#doorTransitionZone;
  }

  get targetLevel(): string {
    return this.#targetLevel;
  }

  get direction(): Direction {
    return this.#direction;
  }

  get doorObject(): Phaser.Types.Physics.Arcade.ImageWithDynamicBody | undefined {
    return this.#doorObject;
  }

  get id(): number {
    return this.#id;
  }

  get trapDoorTrigger(): TrapType {
    return this.#trapDoorTrigger;
  }

  get doorType(): DoorType {
    return this.#doorType;
  }

  public disableObject(disableDoorTrigger = true): void {
    if (disableDoorTrigger) {
      (this.#doorTransitionZone.body as Phaser.Physics.Arcade.Body).enable = false;
      this.#doorTransitionZone.active = true;
    }

    if (this.#doorObject !== undefined) {
      this.#doorObject.body.enable = false;
      this.#doorObject.active = false;
      this.#doorObject.visible = false;
    }
  }

  public enableObject(): void {
    (this.#doorTransitionZone.body as Phaser.Physics.Arcade.Body).enable = true;
    this.#doorTransitionZone.active = true;

    if (this.#isUnlocked) {
      return;
    }

    if (this.#doorObject !== undefined) {
      this.#doorObject.body.enable = true;
      this.#doorObject.active = true;
      this.#doorObject.visible = true;
    }
  }

  public open(): void {
    if (this.#doorType === DOOR_TYPE.LOCK || this.#doorType === DOOR_TYPE.BOSS) {
      this.#isUnlocked = true;
    }

    this.disableObject(false);
  }
}
