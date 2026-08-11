import React, { useEffect, useRef, useState } from 'react';
import './MultiplicationRpg.css';
import { gameUrl } from './gameHosting';

const ASSET_ROOT = gameUrl('simple-rpg/assets');
const QUESTION_DELAY_MS = 20000;
// Phase de test libre : les questions seront réactivées après validation du jeu.
const ENABLE_MULTIPLICATION_QUESTIONS = false;

const makeQuestion = () => {
  const left = 2 + Math.floor(Math.random() * 9);
  const right = 2 + Math.floor(Math.random() * 9);
  return { left, right, expected: left * right };
};

export default function MultiplicationRpg({ onExit }) {
  const canvasHostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const inputRef = useRef(null);
  const questionOpenRef = useRef(false);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [bonus, setBonus] = useState('Aucun bonus');
  const [gameOver, setGameOver] = useState(false);

  const openQuestion = () => {
    if (questionOpenRef.current || gameOver) return;
    questionOpenRef.current = true;
    sceneRef.current?.setQuizPaused(true);
    setQuestion(makeQuestion());
    setAnswer('');
    setFeedback(null);
    window.setTimeout(() => inputRef.current?.focus(), 40);
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
          this.playerSpeed = 125;
          this.isQuizPaused = false;
          this.invulnerableUntil = 0;
          this.slowUntil = 0;
        }

        preload() {
          this.load.tilemapTiledJSON('forest-map', `${ASSET_ROOT}/tilemap.json`);
          this.load.tilemapTiledJSON('forest-map-2', `${ASSET_ROOT}/second-map.json`);
          this.load.image('forest-tiles', `${ASSET_ROOT}/environment/tileset.png`);
          this.load.image('arrow', `${ASSET_ROOT}/sprites/misc/arrow.png`);
          this.load.image('heart', `${ASSET_ROOT}/heart.png`);
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
          (monsterLayer?.objects || []).forEach((obj, index) => {
            const key = String(obj.name || '').toLowerCase().includes('mole') ? 'mole' : 'treant';
            const monster = this.monsters.create(obj.x, obj.y, key).setDepth(8);
            monster.hp = key === 'treant' ? 3 : 2;
            monster.speed = key === 'treant' ? 27 : 36;
            monster.setData('spawnX', obj.x).setData('spawnY', obj.y).setCollideWorldBounds(true);
            monster.play(key === 'treant' ? 'treant-walk' : 'mole-walk');
            monster.setTint(index % 2 ? 0xffffff : 0xfff3cf);
          });
          if (terrain) this.physics.add.collider(this.monsters, terrain);
          if (deco) this.physics.add.collider(this.monsters, deco);
          this.physics.add.overlap(this.arrows, this.monsters, this.hitMonster, null, this);
          this.physics.add.overlap(this.player, this.monsters, this.hitPlayer, null, this);

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
              this.isChangingMap = true;
              const nextMapKey = this.currentMapKey === 'forest-map' ? 'forest-map-2' : 'forest-map';
              const nextSpawn = nextMapKey === 'forest-map-2' ? { x: 60, y: 303 } : { x: 412, y: 430 };
              this.cameras.main.fadeOut(220, 8, 47, 35);
              this.time.delayedCall(230, () => this.scene.restart({ mapKey: nextMapKey, spawn: nextSpawn }));
            });
          });

          this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
          this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
          this.cameras.main.setZoom(2.15);
          this.cameras.main.setBackgroundColor('#173d2b');

          this.add.text(10, 10, `${this.currentMapKey === 'forest-map' ? 'Clairière' : 'Bois profond'}   •   Flèches/ZQSD : bouger   •   ESPACE : tirer`, {
            fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
            backgroundColor: '#082f2399', padding: { x: 8, y: 5 }
          }).setScrollFactor(0).setDepth(100);
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

        grantBonus() {
          this.reloadMs = 155;
          this.playerSpeed = 175;
          this.boostUntil = this.time.now + 12000;
          this.invulnerableUntil = this.boostUntil;
          this.player?.setScale(1.36).setTint(0xff5a42);
          this.powerAura?.setVisible(true);
          this.cameras.main.flash(220, 255, 75, 35, false);
          this.cameras.main.shake(180, 0.006);
          this.time.delayedCall(12000, () => {
            if (this.time.now + 30 < this.boostUntil) return;
            this.reloadMs = 520;
            this.playerSpeed = 125;
            this.player?.setScale(1).clearTint();
            this.powerAura?.setVisible(false);
            setBonus('Aucun bonus');
          });
        }

        grantPenalty() {
          this.slowUntil = this.time.now + 7000;
        }

        update(time) {
          if (!this.player || this.isQuizPaused || !this.player.active) return;
          const left = this.cursors.left.isDown || this.wasd.A.isDown || this.wasd.Q.isDown;
          const right = this.cursors.right.isDown || this.wasd.D.isDown;
          const up = this.cursors.up.isDown || this.wasd.W.isDown || this.wasd.Z.isDown;
          const down = this.cursors.down.isDown || this.wasd.S.isDown;
          const speed = time < this.slowUntil ? 62 : this.playerSpeed;
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

          if (this.space.isDown && time - this.lastShot >= this.reloadMs) this.shoot(time);
          this.monsters.children.iterate((monster) => {
            if (!monster?.active) return;
            const distance = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);
            if (distance < 180) this.physics.moveToObject(monster, this.player, monster.speed);
            else if (distance > 240) this.physics.moveTo(monster, monster.getData('spawnX'), monster.getData('spawnY'), monster.speed * 0.5);
          });
        }

        shoot(time) {
          this.lastShot = time;
          // Le sprite original de la flèche est vertical : sa rotation doit
          // suivre la convention du projet source.
          const vectors = { up: [0, -1, 0], down: [0, 1, 180], left: [-1, 0, -90], right: [1, 0, 90] };
          const [dx, dy, angle] = vectors[this.orientation];
          const shootAnim = this.orientation === 'up' ? 'shoot-up' : this.orientation === 'down' ? 'shoot-down' : 'shoot-side';
          this.player.play(shootAnim, true).setFlipX(this.orientation === 'left');
          const arrow = this.arrows.create(this.player.x + dx * 15, this.player.y + dy * 15, 'arrow');
          arrow.setDepth(9).setAngle(angle).setVelocity(dx * 275, dy * 275).setData('bornAt', time);
          this.time.delayedCall(1500, () => arrow?.active && arrow.destroy());
        }

        hitMonster(arrow, monster) {
          arrow.destroy();
          monster.hp -= this.reloadMs < 200 ? 2 : 1;
          monster.setTint(0xff3b30);
          this.time.delayedCall(100, () => monster?.active && monster.clearTint());
          if (monster.hp <= 0) {
            monster.destroy();
            setScore((value) => value + 100);
          }
        }

        hitPlayer(_player, monster) {
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

  useEffect(() => {
    if (!ENABLE_MULTIPLICATION_QUESTIONS) return undefined;
    const first = window.setTimeout(openQuestion, 12000);
    const interval = window.setInterval(openQuestion, QUESTION_DELAY_MS);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [gameOver]);

  const validateAnswer = (event) => {
    event.preventDefault();
    if (!question || feedback) return;
    const isCorrect = Number(answer) === question.expected;
    if (isCorrect) {
      setFeedback({ ok: true, message: 'Bravo ! Tir rapide, vitesse et bouclier pendant 12 secondes.' });
      setScore((value) => value + 250);
      setHearts((value) => Math.min(5, value + 1));
      setBonus('⚡ Archer renforcé · 12 s');
      sceneRef.current?.grantBonus();
    } else {
      setFeedback({ ok: false, message: `La réponse était ${question.expected}. Tu perds un cœur et ralentis pendant 7 secondes.` });
      setHearts((value) => {
        const next = Math.max(0, value - 1);
        if (next === 0) setGameOver(true);
        return next;
      });
      sceneRef.current?.grantPenalty();
    }
    window.setTimeout(() => {
      if (!gameOver) sceneRef.current?.setQuizPaused(false);
      questionOpenRef.current = false;
      setQuestion(null);
      setFeedback(null);
    }, 1600);
  };

  const restart = () => {
    setHearts(3);
    setScore(0);
    setBonus('Aucun bonus');
    setGameOver(false);
    questionOpenRef.current = false;
    sceneRef.current?.scene.restart();
  };

  return (
    <div className="edu-rpg-shell">
      <header className="edu-rpg-header">
        <div>
          <div className="edu-rpg-kicker">{ENABLE_MULTIPLICATION_QUESTIONS ? 'Calcul mental · aventure' : 'Mode test libre · sans questions'}</div>
          <h1>La forêt des multiplications</h1>
        </div>
        <div className="edu-rpg-hud">
          <div className="edu-rpg-hearts" aria-label={`${hearts} cœurs`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < hearts ? 'active' : ''}>♥</span>)}</div>
          <strong>{score} pts</strong>
          <span>{bonus}</span>
        </div>
        <button type="button" className="edu-rpg-exit" onClick={onExit}>✕ Quitter</button>
      </header>

      <main className="edu-rpg-stage">
        <div ref={canvasHostRef} className="edu-rpg-canvas" />
        <div className="edu-rpg-help">Déplace-toi avec les flèches ou ZQSD · Tire avec ESPACE · Les portes relient les deux cartes.</div>

        {question && !gameOver && (
          <div className="edu-rpg-quiz-backdrop">
            <form className={`edu-rpg-quiz ${feedback ? (feedback.ok ? 'correct' : 'wrong') : ''}`} onSubmit={validateAnswer}>
              <div className="edu-rpg-quiz-label">Le temps est suspendu</div>
              <h2>{question.left} × {question.right} = ?</h2>
              <input ref={inputRef} inputMode="numeric" pattern="[0-9]*" value={answer} onChange={(event) => setAnswer(event.target.value.replace(/\D/g, ''))} disabled={Boolean(feedback)} aria-label="Ta réponse" />
              {feedback ? <p>{feedback.message}</p> : <button type="submit" disabled={!answer}>Valider</button>}
            </form>
          </div>
        )}

        {gameOver && (
          <div className="edu-rpg-quiz-backdrop">
            <div className="edu-rpg-game-over">
              <div className="edu-rpg-quiz-label">Fin de la partie</div>
              <h2>La forêt t’attend encore !</h2>
              <p>Score obtenu : <strong>{score} points</strong></p>
              <button type="button" onClick={restart}>Recommencer</button>
              <button type="button" className="secondary" onClick={onExit}>Retour aux jeux</button>
            </div>
          </div>
        )}
      </main>
      <footer className="edu-rpg-credit">Code adapté de Phaser3 Simple RPG (MIT) · graphismes Tiny RPG Forest par Ansimuz (CC0).</footer>
    </div>
  );
}
