import { DUNGEON_ITEM } from '../../common/common';
import { DungeonItem, LevelName } from '../../common/types';
import { exhaustiveGuard } from '../../common/utils';

type AreaInventory = {
  map: boolean;
  compass: boolean;
  bossKey: boolean;
  keys: number;
};

type ItemInventory = {
  sword: boolean;
};

export type InventoryData = {
  general: ItemInventory;
  area: { [key in LevelName]: AreaInventory };
};

export class InventoryManager {
  static #instance: InventoryManager;

  #generalInventory: ItemInventory;
  #areaInventory: { [key in LevelName]: AreaInventory };

  private constructor() {
    this.#generalInventory = {
      sword: true,
    };
    this.#areaInventory = {
      DUNGEON_1: {
        map: false,
        bossKey: false,
        compass: false,
        keys: 0,
      },
      WORLD: {
        map: false,
        bossKey: false,
        compass: false,
        keys: 0,
      },
    };
  }

  public static get instance(): InventoryManager {
    if (!InventoryManager.#instance) {
      InventoryManager.#instance = new InventoryManager();
    }
    return InventoryManager.#instance;
  }

  get data(): InventoryData {
    return {
      general: { ...this.#generalInventory },
      area: { ...this.#areaInventory },
    };
  }

  set data(data: InventoryData) {
    this.#areaInventory = { ...data.area };
    this.#generalInventory = { ...data.general };
  }

  public addDungeonItem(area: LevelName, dungeonItem: DungeonItem): void {
    switch (dungeonItem) {
      case DUNGEON_ITEM.MAP:
        this.#areaInventory[area].map = true;
        return;
      case DUNGEON_ITEM.COMPASS:
        this.#areaInventory[area].compass = true;
        return;
      case DUNGEON_ITEM.BOSS_KEY:
        this.#areaInventory[area].bossKey = true;
        return;
      case DUNGEON_ITEM.SMALL_KEY:
        this.#areaInventory[area].keys += 1;
        return;
      default:
        exhaustiveGuard(dungeonItem);
    }
  }

  public getAreaInventory(area: LevelName): AreaInventory {
    return { ...this.#areaInventory[area] };
  }

  public useAreaSmallKey(area: LevelName): void {
    if (this.#areaInventory[area].keys > 0) {
      this.#areaInventory[area].keys -= 1;
    }
  }
}
