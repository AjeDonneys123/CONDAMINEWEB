import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MultiplicationRpg.css';
import { gameUrl } from './gameHosting';
import ProtectedGameSurface from '../ProtectedGameSurface';

const ASSET_ROOT = gameUrl('simple-rpg/assets');
const TARGET_GEMS = 4;
const MAX_HEARTS = 6;
const ANSWER_COLORS = [0x00e5ff, 0xffea00, 0x39ff14, 0xff2bd6];
const ANSWER_CSS_COLORS = ['#00e5ff', '#ffea00', '#39ff14', '#ff2bd6'];

export default function MultiplicationRpg({ onExit, learningContext = { lessons: [] } }) {
  const canvasHostRef = useRef(null);
  const screenShieldRef = useRef(null);
  const mobileControlsRef = useRef(null);
  const quizRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const questionRef = useRef(null);
  const questionIndexRef = useRef(0);
  const gemsRef = useRef(0);
  const quizQuestionsRef = useRef([]);
  const virtualKeysRef = useRef(new Set());
  const activeTouchControlsRef = useRef(new Map());
  const wrongQuestionsRef = useRef([]);
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [gems, setGems] = useState(0);
  const [superChallenge, setSuperChallenge] = useState(null);
  const [hearts, setHearts] = useState(3);
  const [scorePop, setScorePop] = useState(null);
  const [scorePopError, setScorePopError] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const wrongStorageKey = `condaweb-forest-wrong-v1:${String(learningContext?.activeChapterId || 'chapter')}`;
  const questionKey = (row = {}) => String(row?.id || row?._id || row?.question || '').trim();
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(wrongStorageKey) || '[]');
      wrongQuestionsRef.current = Array.isArray(saved) ? saved.filter((row) => questionKey(row)) : [];
    } catch (_) { wrongQuestionsRef.current = []; }
  }, [wrongStorageKey]);

  const saveWrongQuestions = (rows) => {
    wrongQuestionsRef.current = rows;
    try { window.localStorage.setItem(wrongStorageKey, JSON.stringify(rows)); } catch (_) {}
  };

  useEffect(() => {
    const shield = screenShieldRef.current;
    if (!shield) return undefined;
    const block = (event) => event.preventDefault();
    const captureOptions = { capture: true };
    const touchOptions = { capture: true, passive: false };
    ['contextmenu', 'selectstart', 'dragstart'].forEach((type) => shield.addEventListener(type, block, captureOptions));
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => shield.addEventListener(type, block, touchOptions));
    return () => {
      ['contextmenu', 'selectstart', 'dragstart'].forEach((type) => shield.removeEventListener(type, block, captureOptions));
      ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => shield.removeEventListener(type, block, touchOptions));
    };
  }, []);

  useEffect(() => {
    const controlsRoot = mobileControlsRef.current;
    const quiz = quizRef.current;
    const targets = [controlsRoot, quiz].filter(Boolean);
    if (!targets.length) return undefined;
    const block = (event) => event.preventDefault();
    const directionCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const blockedTouchIds = new Set();
    let layoutLockedUntil = 0;
    const resolveControl = (touch, selector = '[data-game-code]', preferTouchedElement = false) => {
      if (!controlsRoot || !touch) return '';
      const touchedButton = touch.target?.closest?.('[data-game-code]');
      if (preferTouchedElement && touchedButton && controlsRoot.contains(touchedButton) && touchedButton.matches(selector)) {
        return touchedButton.dataset.gameCode || '';
      }
      const buttons = [...controlsRoot.querySelectorAll(selector)];
      let nearest = null;
      let nearestDistance = Infinity;
      buttons.forEach((button) => {
        const rect = button.getBoundingClientRect();
        const dx = touch.clientX - (rect.left + rect.width / 2);
        const dy = touch.clientY - (rect.top + rect.height / 2);
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = button.dataset.gameCode;
        }
      });
      return nearest || '';
    };
    const releaseTouch = (identifier) => {
      const active = activeTouchControlsRef.current.get(identifier);
      if (active && !['Reload', 'Heal'].includes(active)) setVirtualKey(active, false);
      activeTouchControlsRef.current.delete(identifier);
    };
    const releaseAllTouches = () => {
      [...activeTouchControlsRef.current.keys()].forEach(releaseTouch);
      directionCodes.forEach((code) => setVirtualKey(code, false));
    };
    const handleControlsTouchStart = (event) => {
      event.preventDefault();
      event.stopPropagation();
      [...(event.changedTouches || [])].forEach((touch) => {
        if (blockedTouchIds.has(touch.identifier) || performance.now() < layoutLockedUntil) return;
        releaseTouch(touch.identifier);
        const code = resolveControl(touch, '[data-game-code]', true);
        if (!code) return;
        activeTouchControlsRef.current.set(touch.identifier, code);
        setVirtualKey(code, true);
      });
    };
    const handleControlsTouchMove = (event) => {
      event.preventDefault();
      event.stopPropagation();
      [...(event.changedTouches || event.touches || [])].forEach((touch) => {
        const previous = activeTouchControlsRef.current.get(touch.identifier);
        if (!directionCodes.includes(previous)) return;
        const code = resolveControl(touch, '.edu-rpg-dpad [data-game-code]');
        if (!code || code === previous) return;
        setVirtualKey(previous, false);
        activeTouchControlsRef.current.set(touch.identifier, code);
        setVirtualKey(code, true);
      });
    };
    const handleControlsTouchEnd = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const changed = [...(event.changedTouches || [])];
      if (changed.length) changed.forEach((touch) => {
        releaseTouch(touch.identifier);
        blockedTouchIds.delete(touch.identifier);
      });
      else releaseAllTouches();
    };
    const resetAfterLayoutChange = () => {
      activeTouchControlsRef.current.forEach((_, identifier) => blockedTouchIds.add(identifier));
      releaseAllTouches();
      // Safari recalcule les rectangles tactiles après l'événement de rotation.
      layoutLockedUntil = performance.now() + 280;
    };
    const touchOptions = { passive: false };
    targets.forEach((target) => {
      target.addEventListener('touchmove', block, touchOptions);
      target.addEventListener('contextmenu', block);
      target.addEventListener('selectstart', block);
      target.addEventListener('dragstart', block);
    });
    controlsRoot?.addEventListener('touchstart', handleControlsTouchStart, touchOptions);
    controlsRoot?.addEventListener('touchmove', handleControlsTouchMove, touchOptions);
    controlsRoot?.addEventListener('touchend', handleControlsTouchEnd, touchOptions);
    controlsRoot?.addEventListener('touchcancel', handleControlsTouchEnd, touchOptions);
    window.addEventListener('orientationchange', resetAfterLayoutChange);
    window.addEventListener('resize', resetAfterLayoutChange);
    window.addEventListener('blur', resetAfterLayoutChange);
    return () => {
      releaseAllTouches();
      targets.forEach((target) => {
        target.removeEventListener('touchmove', block, touchOptions);
        target.removeEventListener('contextmenu', block);
        target.removeEventListener('selectstart', block);
        target.removeEventListener('dragstart', block);
      });
      controlsRoot?.removeEventListener('touchstart', handleControlsTouchStart, touchOptions);
      controlsRoot?.removeEventListener('touchmove', handleControlsTouchMove, touchOptions);
      controlsRoot?.removeEventListener('touchend', handleControlsTouchEnd, touchOptions);
      controlsRoot?.removeEventListener('touchcancel', handleControlsTouchEnd, touchOptions);
      window.removeEventListener('orientationchange', resetAfterLayoutChange);
      window.removeEventListener('resize', resetAfterLayoutChange);
      window.removeEventListener('blur', resetAfterLayoutChange);
    };
  }, [question]);

  const quizQuestions = useMemo(() => (learningContext?.lessons || []).flatMap((lesson) =>
    (lesson?.quiz || []).map((row) => ({ ...row, lessonTitle: lesson.title }))
  ), [learningContext]);

  useEffect(() => { quizQuestionsRef.current = quizQuestions; }, [quizQuestions]);

  const getNextQuestion = () => {
    const pool = quizQuestionsRef.current;
    const next = pool.length
      ? pool[questionIndexRef.current++ % pool.length]
      : { unavailable: true, question: 'Aucun QCM disponible pour cette leçon.', choices: ['Continuer'], correctIndex: 0 };
    questionRef.current = next;
    setQuestion(next);
    setFeedback(null);
    return next;
  };

  useEffect(() => {
    let disposed = false;

    const boot = async () => {
      const Phaser = (await import('phaser')).default;
      if (disposed || !canvasHostRef.current) return;

      class ForestScene extends Phaser.Scene {
        constructor() {
          super('forest');
          this.orientation = 'down';
          this.lastShot = 0;
          this.reloadMs = 520;
          this.playerSpeed = 105;
          this.isQuizPaused = false;
          this.invulnerableUntil = 0;
        }

        preload() {
          this.load.tilemapTiledJSON('forest-map', `${ASSET_ROOT}/tilemap.json`);
          this.load.tilemapTiledJSON('forest-map-2', `${ASSET_ROOT}/second-map.json`);
          this.load.image('forest-tiles', `${ASSET_ROOT}/environment/tileset.png`);
          this.load.image('arrow', `${ASSET_ROOT}/sprites/misc/arrow.png`);
          this.load.image('heart', `${ASSET_ROOT}/heart.png`);
          this.load.spritesheet('answer-gem', `${ASSET_ROOT}/spritesheets/misc/gem.png`, { frameWidth: 7, frameHeight: 7 });
          this.load.spritesheet('hero-down', `${ASSET_ROOT}/spritesheets/hero/idle/hero-idle-front.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-up', `${ASSET_ROOT}/spritesheets/hero/idle/hero-idle-back.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-side', `${ASSET_ROOT}/spritesheets/hero/idle/hero-idle-side.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-walk-down', `${ASSET_ROOT}/spritesheets/hero/walk/hero-walk-front.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-walk-up', `${ASSET_ROOT}/spritesheets/hero/walk/hero-walk-back.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-walk-side', `${ASSET_ROOT}/spritesheets/hero/walk/hero-walk-side.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-shoot-down', `${ASSET_ROOT}/spritesheets/hero/attack-weapon/hero-attack-front-weapon.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-shoot-up', `${ASSET_ROOT}/spritesheets/hero/attack-weapon/hero-attack-back-weapon.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('hero-shoot-side', `${ASSET_ROOT}/spritesheets/hero/attack-weapon/hero-attack-side-weapon.png`, { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet('treant', `${ASSET_ROOT}/spritesheets/treant/walk/treant-walk-front.png`, { frameWidth: 31, frameHeight: 35 });
          this.load.spritesheet('mole', `${ASSET_ROOT}/spritesheets/mole/walk/mole-walk-front.png`, { frameWidth: 24, frameHeight: 24 });
        }

        create(data = {}) {
          sceneRef.current = this;
          this.isQuizPaused = false;
          this.isChangingMap = false;
          this.physics.resume();
          this.currentMapKey = data.mapKey === 'forest-map-2' ? 'forest-map-2' : 'forest-map';
          const map = this.make.tilemap({ key: this.currentMapKey });
          const tiles = map.addTilesetImage('tileset', 'forest-tiles', 16, 16, 0, 0);
          const terrain = map.createLayer('terrain', tiles, 0, 0);
          const bridge = map.createLayer('bridge', tiles, 0, 0);
          const deco = map.createLayer('deco', tiles, 0, 0);
          terrain?.setCollisionByProperty({ collides: true });
          deco?.setCollisionByProperty({ collides: true });
          bridge?.setDepth(2);

          this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
          // Position et hitbox du projet d'origine : le héros ne doit pas naître
          // légèrement engagé dans le décor, sinon un axe seul peut rester bloqué.
          const defaultSpawn = this.currentMapKey === 'forest-map-2' ? { x: 60, y: 303 } : { x: 50, y: 200 };
          const spawn = data.spawn || defaultSpawn;
          this.player = this.physics.add.sprite(spawn.x, spawn.y, 'hero-down').setDepth(10).setOrigin(0.5, 0.7);
          this.player.setCollideWorldBounds(true).setSize(10, 10);
          this.powerAura = this.add.circle(this.player.x, this.player.y, 25, 0xff2d20, 0.38)
            .setDepth(9)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setVisible(false);
          this.tweens.add({
            targets: this.powerAura,
            scale: { from: 0.85, to: 1.45 },
            alpha: { from: 0.62, to: 0.12 },
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          if (terrain) this.physics.add.collider(this.player, terrain);
          if (deco) this.physics.add.collider(this.player, deco);

          this.createAnimations();
          this.cursors = this.input.keyboard.createCursorKeys();
          this.wasd = this.input.keyboard.addKeys('W,A,S,D,Z,Q');
          this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
          this.arrows = this.physics.add.group();
          this.monsters = this.physics.add.group();

          const monsterLayer = map.getObjectLayer('monsters');
          this.shrineTeleportPoints = (monsterLayer?.objects || []).map((obj) => ({ x: obj.x, y: obj.y }));
          (monsterLayer?.objects || []).forEach((obj, index) => {
            const key = String(obj.name || '').toLowerCase().includes('mole') ? 'mole' : 'treant';
            [0, 1].forEach((copy) => {
              const angle = Math.PI * copy;
              let spawnX = Phaser.Math.Clamp(obj.x + Math.cos(angle) * 52, 24, map.widthInPixels - 24);
              let spawnY = Phaser.Math.Clamp(obj.y + Math.sin(angle) * 52, 24, map.heightInPixels - 24);
              const fromPlayerX = spawnX - this.player.x;
              const fromPlayerY = spawnY - this.player.y;
              const fromPlayerDistance = Math.hypot(fromPlayerX, fromPlayerY) || 1;
              if (fromPlayerDistance < 150) {
                spawnX = Phaser.Math.Clamp(this.player.x + (fromPlayerX / fromPlayerDistance) * 165, 24, map.widthInPixels - 24);
                spawnY = Phaser.Math.Clamp(this.player.y + (fromPlayerY / fromPlayerDistance) * 165, 24, map.heightInPixels - 24);
              }
              const monster = this.monsters.create(spawnX, spawnY, key).setDepth(8);
              monster.hp = 1;
              monster.speed = key === 'treant' ? 24 : 30;
              monster.setData('spawnX', spawnX).setData('spawnY', spawnY).setCollideWorldBounds(true);
              monster.setData('kind', key);
              monster.play(key === 'treant' ? 'treant-walk' : 'mole-walk');
            });
          });
          if (terrain) this.physics.add.collider(this.monsters, terrain);
          if (deco) this.physics.add.collider(this.monsters, deco);
          this.physics.add.collider(this.monsters, this.monsters);
          this.physics.add.overlap(this.arrows, this.monsters, this.hitMonster, null, this);
          this.physics.add.overlap(this.player, this.monsters, this.hitPlayer, null, this);

          this.activeGemQuestion = false;
          this.answerGems = this.physics.add.group();
          this.shrines = this.physics.add.staticGroup();
          const isWalkableTile = (tileX, tileY) => {
            if (tileX < 1 || tileY < 1 || tileX >= map.width - 1 || tileY >= map.height - 1) return false;
            const terrainTile = terrain?.getTileAt(tileX, tileY);
            const decoTile = deco?.getTileAt(tileX, tileY);
            return !terrainTile?.collides && !decoTile?.collides;
          };
          const startTileX = map.worldToTileX(this.player.x);
          const startTileY = map.worldToTileY(this.player.y);
          let seedTile = [startTileX, startTileY];
          for (let radius = 0; radius <= 3 && !isWalkableTile(seedTile[0], seedTile[1]); radius += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              for (let dy = -radius; dy <= radius; dy += 1) {
                if (isWalkableTile(startTileX + dx, startTileY + dy)) seedTile = [startTileX + dx, startTileY + dy];
              }
            }
          }
          const queue = [seedTile];
          const visited = new Set([`${seedTile[0]},${seedTile[1]}`]);
          const reachable = [];
          for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const [tileX, tileY] = queue[cursor];
            if (!isWalkableTile(tileX, tileY)) continue;
            const worldX = map.tileToWorldX(tileX) + map.tileWidth / 2;
            const worldY = map.tileToWorldY(tileY) + map.tileHeight / 2;
            if (Phaser.Math.Distance.Between(worldX, worldY, this.player.x, this.player.y) > 90) reachable.push({ x: worldX, y: worldY });
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
              const nextX = tileX + dx;
              const nextY = tileY + dy;
              const key = `${nextX},${nextY}`;
              if (!visited.has(key) && isWalkableTile(nextX, nextY)) { visited.add(key); queue.push([nextX, nextY]); }
            });
          }
          this.safeShrinePoints = reachable.filter((_point, index) => index % 6 === 0);
          const shrinePositions = Array.from({ length: 4 }, (_, index) => {
            const point = this.safeShrinePoints[Math.floor(((index + 1) * this.safeShrinePoints.length) / 5)] || { x: this.player.x + 80 + index * 24, y: this.player.y + 80 };
            return [point.x, point.y];
          });
          shrinePositions.forEach(([x, y], index) => {
            const shrine = this.shrines.create(x, y, 'answer-gem', index % 4).setScale(3).setDepth(7);
            shrine.setData('used', false).setTint(0xffffff);
            this.tweens.add({ targets: shrine, y: y - 5, duration: 650, yoyo: true, repeat: -1 });
          });
          const superPoint = this.safeShrinePoints[Math.floor(this.safeShrinePoints.length / 2)] || { x: this.player.x + 100, y: this.player.y };
          const superX = superPoint.x;
          const superY = superPoint.y;
          const superGlow = this.add.circle(superX, superY, 22, 0xffd900, 0.28).setDepth(6);
          const superShrine = this.shrines.create(superX, superY, 'answer-gem', 0)
            .setScale(4.2).setDepth(7).setTintFill(0xffe600);
          superShrine.setData('used', false).setData('isSuper', true).setData('glow', superGlow);
          this.tweens.add({ targets: superShrine, scale: { from: 3.6, to: 4.8 }, alpha: { from: 0.65, to: 1 }, duration: 520, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: superGlow, scale: { from: 0.8, to: 1.35 }, alpha: { from: 0.18, to: 0.55 }, duration: 520, yoyo: true, repeat: -1 });
          this.physics.add.overlap(this.player, this.shrines, (_player, shrine) => this.beginGemQuestion(shrine), null, this);

          // Les rectangles "zones" sont les portes reliant les deux cartes
          // dans le projet RPG original.
          const exitLayer = map.getObjectLayer('zones');
          (exitLayer?.objects || []).forEach((exit) => {
            const portalX = exit.x + exit.width / 2;
            const portalY = exit.y + exit.height / 2;
            const portal = this.add.rectangle(portalX, portalY, Math.max(22, exit.width + 10), Math.max(54, exit.height + 8), 0xa855f7, 0.34)
              .setDepth(7)
              .setStrokeStyle(3, 0xf0abfc, 0.95);
            const portalLabel = this.add.text(portalX, portalY - Math.max(38, exit.height / 2 + 14), 'PASSAGE', {
              fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: '#ffffff',
              backgroundColor: '#6b21a8cc', padding: { x: 5, y: 3 }
            }).setOrigin(0.5).setDepth(20);
            this.tweens.add({ targets: [portal, portalLabel], alpha: { from: 0.42, to: 1 }, duration: 650, yoyo: true, repeat: -1 });
            const zone = this.add.zone(portalX, portalY, Math.max(18, exit.width), Math.max(44, exit.height));
            this.physics.add.existing(zone, true);
            this.physics.add.overlap(this.player, zone, () => {
              if (this.isChangingMap) return;
              if (this.currentMapKey === 'forest-map-2') {
                if (gemsRef.current < TARGET_GEMS) {
                  setScorePop(`Encore ${TARGET_GEMS - gemsRef.current} gemme(s)`);
                  window.setTimeout(() => setScorePop(null), 1200);
                  return;
                }
                this.setQuizPaused(true);
                setWon(true);
                return;
              }
              if (gemsRef.current < TARGET_GEMS) {
                setScorePop(`Encore ${TARGET_GEMS - gemsRef.current} gemme(s) pour ouvrir le passage`);
                window.setTimeout(() => setScorePop(null), 1200);
                return;
              }
              this.isChangingMap = true;
              const nextMapKey = this.currentMapKey === 'forest-map' ? 'forest-map-2' : 'forest-map';
              const nextSpawn = nextMapKey === 'forest-map-2' ? { x: 60, y: 303 } : { x: 412, y: 430 };
              gemsRef.current = 0;
              setGems(0);
              this.cameras.main.fadeOut(220, 8, 47, 35);
              this.time.delayedCall(230, () => this.scene.restart({ mapKey: nextMapKey, spawn: nextSpawn }));
            });
          });

          this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
          this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
          this.cameras.main.setZoom(2.15);
          this.cameras.main.setBackgroundColor('#173d2b');

          this.add.text(10, 10, `${this.currentMapKey === 'forest-map' ? 'Clairière' : 'Bois profond'}   •   Forêt des savoirs`, {
            fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
            backgroundColor: '#082f2399', padding: { x: 8, y: 5 }
          }).setScrollFactor(0).setDepth(100);
        }

        beginGemQuestion(shrine) {
          if (this.activeGemQuestion || shrine.getData('used')) return;
          if (!shrine.getData('isSuper')) this.deactivatePower();
          this.activeGemQuestion = true;
          this.activeShrine = shrine;
          this.superQuestionMode = Boolean(shrine.getData('isSuper'));
          if (this.superQuestionMode) {
            this.superAttempts = 0;
            this.superCorrect = 0;
            this.superDeadline = this.time.now + 30000;
            this.lastSuperDisplay = -1;
            setSuperChallenge({ answered: 0, seconds: 30 });
          }
          this.showAnswerGems();
          this.monsters.setVelocity(0, 0);
        }

        showAnswerGems() {
          const next = getNextQuestion();
          const offsets = [[0, -58], [58, 0], [0, 58], [-58, 0]];
          if (!this.shield) {
            this.shield = this.add.circle(this.player.x, this.player.y, 88, 0x38bdf8, 0.12)
              .setStrokeStyle(4, 0x7dd3fc, 0.95).setDepth(6);
          }
          this.answerGems.clear(true, true);
          (next.choices || []).slice(0, 4).forEach((_choice, index) => {
            const [dx, dy] = offsets[index];
            const gem = this.answerGems.create(this.player.x + dx, this.player.y + dy, 'answer-gem', index % 4)
              .setScale(3.2).setDepth(15).setTint(ANSWER_COLORS[index] || ANSWER_COLORS[0]);
            gem.setData('answerIndex', index).body.setCircle(6);
          });
        }

        chooseAnswerIndex(answerIndex) {
          if (!this.activeGemQuestion) return;
          const isCorrect = Number(answerIndex) === Number(questionRef.current?.correctIndex);
          if (this.superQuestionMode) {
            this.superAttempts += 1;
            if (isCorrect) this.superCorrect += 1;
            setSuperChallenge({ answered: this.superAttempts, seconds: Math.max(0, Math.ceil((this.superDeadline - this.time.now) / 1000)) });
            if (this.superAttempts >= 4) {
              if (this.superCorrect === 4) this.completeSuperChallenge();
              else this.failSuperChallenge();
            } else {
              setScorePop(isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse');
              setScorePopError(!isCorrect);
              window.setTimeout(() => { setScorePop(null); setScorePopError(false); }, 650);
              this.showAnswerGems();
            }
            return;
          }
          if (isCorrect) {
            setScorePopError(false);
            gemsRef.current = Math.min(TARGET_GEMS, gemsRef.current + 1);
            setGems(gemsRef.current);
            setHearts((value) => Math.min(MAX_HEARTS, value + 1));
            this.activeShrine?.setData('used', true).setVisible(false).disableBody(true, true);
            setScorePop(`Bonne réponse · 💎 ${gemsRef.current}/${TARGET_GEMS}`);
          } else {
            setScorePopError(true);
            setScorePop(`Mauvaise réponse · ${questionRef.current?.choices?.[questionRef.current?.correctIndex] || ''}`);
            const destinations = (this.safeShrinePoints || []).filter((point) =>
              Phaser.Math.Distance.Between(point.x, point.y, this.player.x, this.player.y) > 110
            );
            const destination = destinations[Math.floor(Math.random() * destinations.length)];
            if (this.activeShrine && destination) {
              this.tweens.killTweensOf(this.activeShrine);
              this.activeShrine.setPosition(destination.x, destination.y).refreshBody();
            }
          }
          window.setTimeout(() => { setScorePop(null); setScorePopError(false); }, 1100);
          this.activeGemQuestion = false;
          this.answerGems.clear(true, true);
          this.shield?.destroy();
          this.shield = null;
          this.activeShrine = null;
          questionRef.current = null;
          setQuestion(null);
        }

        completeSuperChallenge() {
          this.finishQuestionPhase();
          this.poweredUntil = this.time.now + 20000;
          this.player.setScale(1.5);
          this.powerAura?.setVisible(true);
          this.activeShrine?.setData('used', true).disableBody(true, true).setVisible(false);
          this.activeShrine?.getData('glow')?.setVisible(false);
          this.activeShrine = null;
          setScorePopError(false);
          setScorePop('SUPER POUVOIR · boules de feu pendant 20 secondes !');
          window.setTimeout(() => setScorePop(null), 1300);
        }

        failSuperChallenge() {
          this.finishQuestionPhase();
          setHearts((value) => {
            const next = Math.max(0, value - 1);
            if (next === 0) { this.setQuizPaused(true); setGameOver(true); }
            return next;
          });
          this.activeShrine = null;
          setScorePopError(true);
          setScorePop('Défi échoué · −1 cœur');
          window.setTimeout(() => { setScorePop(null); setScorePopError(false); }, 1100);
        }

        finishQuestionPhase() {
          this.activeGemQuestion = false;
          this.superQuestionMode = false;
          this.superDeadline = 0;
          setSuperChallenge(null);
          this.answerGems.clear(true, true);
          this.shield?.destroy();
          this.shield = null;
          questionRef.current = null;
          setQuestion(null);
        }

        deactivatePower() {
          this.poweredUntil = 0;
          this.player?.setScale(1);
          this.powerAura?.setVisible(false);
        }

        createAnimations() {
          const add = (key, source, end, frameRate = 10) => {
            if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(source, { start: 0, end }), frameRate, repeat: -1 });
          };
          add('walk-down', 'hero-walk-down', 2);
          add('walk-up', 'hero-walk-up', 2);
          add('walk-side', 'hero-walk-side', 2);
          add('shoot-down', 'hero-shoot-down', 2, 12);
          add('shoot-up', 'hero-shoot-up', 2, 12);
          add('shoot-side', 'hero-shoot-side', 2, 12);
          add('treant-walk', 'treant', 3, 7);
          add('mole-walk', 'mole', 3, 7);
        }

        setQuizPaused(paused) {
          this.isQuizPaused = paused;
          if (paused) {
            this.physics.pause();
            this.player?.setVelocity(0);
          } else {
            this.physics.resume();
          }
        }

        update(time) {
          if (!this.player || this.isQuizPaused || !this.player.active) return;
          if (this.superQuestionMode) {
            const seconds = Math.max(0, Math.ceil((this.superDeadline - time) / 1000));
            if (seconds !== this.lastSuperDisplay) {
              this.lastSuperDisplay = seconds;
              setSuperChallenge({ answered: this.superAttempts, seconds });
            }
            if (time >= this.superDeadline) { this.failSuperChallenge(); return; }
          }
          if (this.poweredUntil && time >= this.poweredUntil) this.deactivatePower();
          if (this.activeGemQuestion) {
            this.player.setVelocity(0);
            this.monsters.setVelocity(0, 0);
            return;
          }
          const virtual = virtualKeysRef.current;
          const left = virtual.has('ArrowLeft') || this.cursors.left.isDown || this.wasd.A.isDown || this.wasd.Q.isDown;
          const right = virtual.has('ArrowRight') || this.cursors.right.isDown || this.wasd.D.isDown;
          const up = virtual.has('ArrowUp') || this.cursors.up.isDown || this.wasd.W.isDown || this.wasd.Z.isDown;
          const down = virtual.has('ArrowDown') || this.cursors.down.isDown || this.wasd.S.isDown;
          const speed = this.playerSpeed;
          if (this.powerAura) this.powerAura.setPosition(this.player.x, this.player.y + 2);
          this.player.setVelocity(0);
          if (left) { this.player.setVelocityX(-speed); this.orientation = 'left'; }
          else if (right) { this.player.setVelocityX(speed); this.orientation = 'right'; }
          if (up) { this.player.setVelocityY(-speed); this.orientation = 'up'; }
          else if (down) { this.player.setVelocityY(speed); this.orientation = 'down'; }
          // Même vitesse dans toutes les directions, sans recalcul susceptible
          // d'annuler un déplacement purement vertical ou horizontal.
          if ((left || right) && (up || down)) {
            this.player.setVelocity(this.player.body.velocity.x * Math.SQRT1_2, this.player.body.velocity.y * Math.SQRT1_2);
          }
          if (left || right || up || down) {
            const anim = up ? 'walk-up' : down ? 'walk-down' : 'walk-side';
            this.player.play(anim, true).setFlipX(this.orientation === 'left');
          } else if (!this.player.anims.currentAnim?.key?.startsWith('shoot')) {
            const idleKey = this.orientation === 'up' ? 'hero-up' : this.orientation === 'down' ? 'hero-down' : 'hero-side';
            this.player.setTexture(idleKey, 0).setFlipX(this.orientation === 'left');
          }

          if ((virtual.has('Shoot') || this.space.isDown) && time - this.lastShot >= this.reloadMs) this.shoot(time);
          this.monsters.children.iterate((monster) => {
            if (!monster?.active) return;
            if (this.activeGemQuestion) { monster.setVelocity(0); return; }
            const distance = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);
            if (distance < 280) this.physics.moveToObject(monster, this.player, monster.speed);
            else this.physics.moveTo(monster, monster.getData('spawnX'), monster.getData('spawnY'), monster.speed * 0.6);
          });
          const activeMonsters = this.monsters.getChildren().filter((monster) => monster?.active);
          for (let i = 0; i < activeMonsters.length; i += 1) {
            for (let j = i + 1; j < activeMonsters.length; j += 1) {
              const first = activeMonsters[i];
              const second = activeMonsters[j];
              const dx = second.x - first.x;
              const dy = second.y - first.y;
              const distance = Math.hypot(dx, dy) || 0.01;
              const minimumDistance = 46;
              if (distance >= minimumDistance) continue;
              const push = (minimumDistance - distance) * 1.8;
              const nx = dx / distance;
              const ny = dy / distance;
              first.body.velocity.x -= nx * push;
              first.body.velocity.y -= ny * push;
              second.body.velocity.x += nx * push;
              second.body.velocity.y += ny * push;
            }
          }
        }

        shoot(time) {
          this.lastShot = time;
          // Le sprite original de la flèche est vertical : sa rotation doit
          // suivre la convention du projet source.
          const vectors = { up: [0, -1, 0], down: [0, 1, 180], left: [-1, 0, -90], right: [1, 0, 90] };
          const [dx, dy, angle] = vectors[this.orientation];
          const shootAnim = this.orientation === 'up' ? 'shoot-up' : this.orientation === 'down' ? 'shoot-down' : 'shoot-side';
          this.player.play(shootAnim, true).setFlipX(this.orientation === 'left');
          let arrow;
          if (this.poweredUntil > time) {
            arrow = this.add.circle(this.player.x + dx * 18, this.player.y + dy * 18, 8, 0xff5a00, 1)
              .setStrokeStyle(4, 0xffd000, 0.95).setDepth(16);
            this.physics.add.existing(arrow);
            this.arrows.add(arrow);
            arrow.body.setVelocity(dx * 350, dy * 350);
          } else {
            arrow = this.arrows.create(this.player.x + dx * 15, this.player.y + dy * 15, 'arrow');
            arrow.setDepth(9).setAngle(angle).setVelocity(dx * 275, dy * 275);
          }
          arrow.setData('bornAt', time);
          this.time.delayedCall(1500, () => arrow?.active && arrow.destroy());
        }

        respawnMonster(spawnX, spawnY, kind) {
          if (!this.player?.active) return;
          if (Phaser.Math.Distance.Between(spawnX, spawnY, this.player.x, this.player.y) < 160) {
            this.time.delayedCall(900, () => this.respawnMonster(spawnX, spawnY, kind));
            return;
          }
          const revived = this.monsters.create(spawnX, spawnY, kind).setDepth(8).setCollideWorldBounds(true);
          revived.hp = 1;
          revived.speed = kind === 'treant' ? 24 : 30;
          revived.setData('spawnX', spawnX).setData('spawnY', spawnY).setData('kind', kind);
          revived.play(kind === 'treant' ? 'treant-walk' : 'mole-walk');
        }

        hitMonster(arrow, monster) {
          arrow.destroy();
          const spawnX = monster.getData('spawnX');
          const spawnY = monster.getData('spawnY');
          const kind = monster.getData('kind');
          monster.destroy();
          this.time.delayedCall(2500, () => this.respawnMonster(spawnX, spawnY, kind));
        }

        hitPlayer(_player, monster) {
          if (this.activeGemQuestion) return;
          if (this.time.now < this.invulnerableUntil || this.time.now < (this.lastPlayerHit || 0) + 900) return;
          this.lastPlayerHit = this.time.now;
          monster.setVelocity(-monster.body.velocity.x * 3, -monster.body.velocity.y * 3);
          setHearts((value) => {
            const next = Math.max(0, value - 1);
            if (next === 0) {
              this.setQuizPaused(true);
              setGameOver(true);
            }
            return next;
          });
          this.cameras.main.shake(180, 0.012);
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: canvasHostRef.current,
        width: 960,
        height: 600,
        backgroundColor: '#173d2b',
        pixelArt: true,
        physics: { default: 'arcade', arcade: { debug: false } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [ForestScene]
      });
    };

    boot();
    return () => {
      disposed = true;
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const restart = () => {
    virtualKeysRef.current.clear();
    setHearts(3);
    setGameOver(false);
    gemsRef.current = 0;
    setGems(0);
    setQuestion(null);
    sceneRef.current?.scene.restart();
  };

  const setVirtualKey = (code, pressed) => {
    if (pressed) virtualKeysRef.current.add(code);
    else virtualKeysRef.current.delete(code);
  };

  const blockGameGesture = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const pressControl = (event, code) => {
    blockGameGesture(event);
    // Sur Safari iOS, la direction est résolue depuis les coordonnées du doigt
    // par le gestionnaire TouchEvent natif du pavé.
    if (event.pointerType === 'touch') return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setVirtualKey(code, true);
  };

  const releaseControl = (event, code) => {
    blockGameGesture(event);
    setVirtualKey(code, false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <ProtectedGameSurface><div className="edu-rpg-shell">
      <header className="edu-rpg-header">
        <div>
          <div className="edu-rpg-kicker">Aventure éducative · QCM du chapitre</div>
          <h1>La forêt des savoirs</h1>
        </div>
        <div className="edu-rpg-hud">
          <div className="edu-rpg-hearts" aria-label={`${hearts} cœurs`}>{Array.from({ length: MAX_HEARTS }, (_, i) => <span key={i} className={i < hearts ? 'active' : ''}>♥</span>)}</div>
          <strong>💎 {gems}/{TARGET_GEMS}</strong>
          <span>🏹 Flèches infinies · trouve un diamant</span>
          {superChallenge && <span>⚡ Super-gemme : {superChallenge.answered}/4 · {superChallenge.seconds}s</span>}
        </div>
        <button type="button" className="edu-rpg-exit" onClick={onExit}>✕ Quitter</button>
      </header>

      <main className="edu-rpg-stage">
        <div ref={canvasHostRef} className="edu-rpg-canvas" />
        <div ref={screenShieldRef} className="edu-rpg-screen-shield" aria-hidden="true" />
        {question && <div className={`edu-rpg-combat-question ${superChallenge ? 'is-super' : ''}`}>
          {superChallenge && <div className="edu-rpg-super-banner"><strong>⚡ DÉFI CHRONO ⚡</strong><b>{superChallenge.seconds}s</b><span>QUESTION {Math.min(4, superChallenge.answered + 1)}/4</span></div>}
          <strong>{question.question}</strong>
        </div>}
        {question && <div className="edu-rpg-answer-bar">{(question.choices || []).map((choice, index) => <button key={index} type="button" style={{ backgroundColor: ANSWER_CSS_COLORS[index] || ANSWER_CSS_COLORS[0] }} onClick={() => sceneRef.current?.chooseAnswerIndex(index)}>{choice}</button>)}</div>}
        {!question && <div className="edu-rpg-help">Rejoins un diamant pour faire apparaître une question.</div>}
        {scorePop && <div className={`edu-rpg-score-pop ${scorePopError ? 'is-error' : ''}`}>{scorePop}</div>}
        {!question && <div ref={mobileControlsRef} className="edu-rpg-mobile-controls" onContextMenu={(event) => event.preventDefault()}>
          <div className="edu-rpg-dpad">
            {[
              ['ArrowUp', 'up', '▲'],
              ['ArrowLeft', 'left', '◀'],
              ['ArrowDown', 'down', '▼'],
              ['ArrowRight', 'right', '▶']
            ].map(([code, direction, label]) => <button type="button" key={code} data-game-code={code} aria-label={code} className={`edu-rpg-control dir-${direction}`} onPointerDown={(event) => pressControl(event, code)} onPointerUp={(event) => releaseControl(event, code)} onPointerCancel={(event) => releaseControl(event, code)}>{label}</button>)}
          </div>
          <div className="edu-rpg-actions">
            <button type="button" data-game-code="Shoot" aria-label="Tirer" className="edu-rpg-control shoot correct-shot" onPointerDown={(event) => pressControl(event, 'Shoot')} onPointerUp={(event) => releaseControl(event, 'Shoot')} onPointerCancel={(event) => releaseControl(event, 'Shoot')}><span aria-hidden="true">➤</span><small>TIRER</small><kbd>ESPACE</kbd></button>
          </div>
        </div>}

        {gameOver && (
          <div className="edu-rpg-quiz-backdrop">
            <div className="edu-rpg-game-over">
              <div className="edu-rpg-quiz-label">Fin de la partie</div>
              <h2>La forêt t’attend encore !</h2>
              <p>Tu peux repartir à la recherche des gemmes.</p>
              <button type="button" onClick={restart}>Recommencer</button>
              <button type="button" className="secondary" onClick={onExit}>Retour aux jeux</button>
            </div>
          </div>
        )}
        {won && <div className="edu-rpg-quiz-backdrop"><div className="edu-rpg-game-over"><div className="edu-rpg-quiz-label">Mission réussie</div><h2>Forêt maîtrisée !</h2><p>Tu as trouvé les 4 gemmes et atteint la dernière porte.</p><button type="button" onClick={restart}>Rejouer</button><button type="button" className="secondary" onClick={onExit}>Retour aux jeux</button></div></div>}
      </main>
      <footer className="edu-rpg-credit">Code adapté de Phaser3 Simple RPG (MIT) · graphismes Tiny RPG Forest par Ansimuz (CC0).</footer>
    </div></ProtectedGameSurface>
  );
}
