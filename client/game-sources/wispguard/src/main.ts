import * as Phaser from 'phaser';
import { SCENE_KEYS } from './scenes/scene-keys';
import { PreloadScene } from './scenes/preload-scene';
import { GameScene } from './scenes/game-scene';
import { UiScene } from './scenes/ui-scene';
import { GameOverScene } from './scenes/game-over-scene';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  pixelArt: true,
  roundPixels: true,
  scale: {
    parent: 'game-container',
    width: 256,
    height: 224,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Agrandit la résolution pixel-art de 256 × 224 autant que possible,
    // tout en conservant le ratio du jeu dans la liseuse plein écran.
    mode: Phaser.Scale.FIT,
  },
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0, x: 0 },
      debug: false,
    },
  },
};

const game = new Phaser.Game(gameConfig);

(window as Window & { condamineGrantBonus?: (bonus: string) => void }).condamineGrantBonus = (bonus: string): void => {
  const scene = game.scene.getScene(SCENE_KEYS.GAME_SCENE) as GameScene | undefined;
  scene?.applyEducationalBonus(bonus);
};

(window as Window & {
  condamineBeginSpritePlacement?: (dataUrl: string) => void;
}).condamineBeginSpritePlacement = (dataUrl: string): void => {
  const scene = game.scene.getScene(SCENE_KEYS.GAME_SCENE) as GameScene | undefined;
  scene?.beginBlockingSpritePlacement(dataUrl);
};

(window as Window & {
  condamineBeginAnimatedSpritePlacement?: (frames: string[]) => void;
}).condamineBeginAnimatedSpritePlacement = (frames: string[]): void => {
  const scene = game.scene.getScene(SCENE_KEYS.GAME_SCENE) as GameScene | undefined;
  scene?.beginAnimatedSpritePlacement(frames);
};

game.scene.add(SCENE_KEYS.PRELOAD_SCENE, PreloadScene);
game.scene.add(SCENE_KEYS.GAME_SCENE, GameScene);
game.scene.add(SCENE_KEYS.UI_SCENE, UiScene);
game.scene.add(SCENE_KEYS.GAME_OVER_SCENE, GameOverScene);
game.scene.start(SCENE_KEYS.PRELOAD_SCENE);
