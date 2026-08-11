import * as Phaser from 'phaser';
import { SCENE_KEYS } from './scene-keys';
import { ASSET_KEYS } from '../common/assets';
import { KeyboardComponent } from '../components/input/keyboard-component';
import { DataManager } from '../common/data-manager';
import { DEFAULT_UI_TEXT_STYLE } from '../common/common';

export class GameOverScene extends Phaser.Scene {
  #menuContainer!: Phaser.GameObjects.Container;
  #cursorGameObject!: Phaser.GameObjects.Image;
  #controls!: KeyboardComponent;
  #selectedMenuOptionIndex!: number;

  constructor() {
    super({
      key: SCENE_KEYS.GAME_OVER_SCENE,
    });
  }

  public create(): void {
    if (!this.input.keyboard) {
      return;
    }

    this.add.text(this.scale.width / 2, 100, 'Game Over', DEFAULT_UI_TEXT_STYLE).setOrigin(0.5);

    this.#menuContainer = this.add.container(32, 142, [
      this.add.image(0, 0, ASSET_KEYS.UI_DIALOG, 0).setOrigin(0),
      this.add.text(32, 16, 'Continue', DEFAULT_UI_TEXT_STYLE).setOrigin(0),
      this.add.text(32, 32, 'Quit', DEFAULT_UI_TEXT_STYLE).setOrigin(0),
    ]);
    this.#cursorGameObject = this.add.image(20, 14, ASSET_KEYS.UI_CURSOR, 0).setOrigin(0);
    this.#menuContainer.add(this.#cursorGameObject);

    this.#controls = new KeyboardComponent(this.input.keyboard);
    this.#selectedMenuOptionIndex = 0;
    DataManager.instance.resetPlayerHealthToMin();
  }

  public update(): void {
    if (this.#controls.isActionKeyJustDown || this.#controls.isAttackKeyJustDown || this.#controls.isEnterKeyJustDown) {
      if (this.#selectedMenuOptionIndex === 1) {
        // this option would be used to take the player back to the title screen for the game
        // instead of refreshing the current browser tab
        window.location.reload();
        return;
      }

      this.scene.start(SCENE_KEYS.GAME_SCENE);
      return;
    }

    if (this.#controls.isUpJustDown) {
      this.#selectedMenuOptionIndex -= 1;
      if (this.#selectedMenuOptionIndex < 0) {
        this.#selectedMenuOptionIndex = 0;
      }
    } else if (this.#controls.isDownJustDown) {
      this.#selectedMenuOptionIndex += 1;
      if (this.#selectedMenuOptionIndex > 1) {
        this.#selectedMenuOptionIndex = 1;
      }
    } else {
      return;
    }

    this.#cursorGameObject.setY(14 + this.#selectedMenuOptionIndex * 16);
  }
}
