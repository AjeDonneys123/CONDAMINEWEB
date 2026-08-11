import * as Phaser from 'phaser';

export const EVENT_BUS = new Phaser.Events.EventEmitter();

export const CUSTOM_EVENTS = {
  OPENED_CHEST: 'OPENED_CHEST',
  ENEMY_DESTROYED: 'ENEMY_DESTROYED',
  PLAYER_DEFEATED: 'PLAYER_DEFEATED',
  PLAYER_HEALTH_UPDATED: 'PLAYER_HEALTH_UPDATED',
  SHOW_DIALOG: 'SHOW_DIALOG',
  DIALOG_CLOSED: 'DIALOG_CLOSED',
  BOSS_DEFEATED: 'BOSS_DEFEATED',
} as const;

export const PLAYER_HEALTH_UPDATE_TYPE = {
  INCREASE: 'INCREASE',
  DECREASE: 'DECREASE',
} as const;

export type PlayerHealthUpdateType = keyof typeof PLAYER_HEALTH_UPDATE_TYPE;

export type PlayerHealthUpdated = {
  currentHealth: number;
  previousHealth: number;
  type: PlayerHealthUpdateType;
};
