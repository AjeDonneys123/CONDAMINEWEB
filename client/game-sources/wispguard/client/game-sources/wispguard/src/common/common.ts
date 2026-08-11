import * as Phaser from 'phaser';
import { ASSET_KEYS } from './assets';

export const DIRECTION = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
} as const;

export const CHEST_STATE = {
  HIDDEN: 'HIDDEN',
  REVEALED: 'REVEALED',
  OPEN: 'OPEN',
} as const;

export const INTERACTIVE_OBJECT_TYPE = {
  AUTO: 'AUTO',
  PICKUP: 'PICKUP',
  OPEN: 'OPEN',
} as const;

export const LEVEL_NAME = {
  WORLD: 'WORLD',
  DUNGEON_1: 'DUNGEON_1',
} as const;

export const DUNGEON_ITEM = {
  SMALL_KEY: 'SMALL_KEY',
  BOSS_KEY: 'BOSS_KEY',
  MAP: 'MAP',
  COMPASS: 'COMPASS',
} as const;

export const DEFAULT_UI_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  align: 'center',
  fontFamily: ASSET_KEYS.FONT_PRESS_START_2P,
  fontSize: 8,
  wordWrap: { width: 170 },
  color: '#FFFFFF',
};

export const CHEST_REWARD_TO_DIALOG_MAP = {
  SMALL_KEY: 'You found a small key! You can use this to open locked doors.',
  BOSS_KEY:
    'You got the Big Key! This is the master key of the dungeon. It can open many locks that small keys cannot.',
  MAP: 'You got the Map! You can use it to see your current position and the rest of the dungeon (Press X).',
  COMPASS: "You fond the Compass! Now you can pinpoint the lair of the dungeon's evil master!",
  NOTHING: '...The chest was empty!',
} as const;
