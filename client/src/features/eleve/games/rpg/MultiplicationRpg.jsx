import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MultiplicationRpg.css';
import { gameUrl } from './gameHosting';

const ASSET_ROOT = gameUrl('simple-rpg/assets');
const TARGET_SCORE = 400;
const MAX_ARROWS = 10;

export default function MultiplicationRpg({ onExit, learningContext = { lessons: [] } }) {
  const canvasHostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const questionOpenRef = useRef(false);
  const virtualKeysRef = useRef(new Set());
  const quizPoolRef = useRef([]);
  const quizStepRef = useRef(0);
  const scoreRef = useRef(0);
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [arrows, setArrows] = useState(MAX_ARROWS);
  const [scorePop, setScorePop] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  useEffect(() => { scoreRef.current = score; }, [score]);

  const quizQuestions = useMemo(() => (learningContext?.lessons || []).flatMap((lesson) =>
    (lesson?.quiz || []).map((row) => ({ ...row, lessonTitle: lesson.title }))
  ), [learningContext]);

  const openQuestion = () => {
    if (questionOpenRef.current || gameOver) return;
    questionOpenRef.current = true;
    sceneRef.current?.setQuizPaused(true);
    const shuffled = [...quizQuestions].sort(() => Math.random() - 0.5);
    quizPoolRef.current = Array.from({ length: 4 }, (_, index) => shuffled[index % Math.max(1, shuffled.length)]).filter(Boolean);
    quizStepRef.current = 0;
    setQuestion(quizPoolRef.current[0] || { unavailable: true, question: 'Aucun QCM disponible pour cette leçon.', choices: ['Fermer'], correctIndex: -1 });
    setFeedback(null);
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
          this.ammo = MAX_ARROWS;
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
          this.ammo = Number.isFinite(data.ammo) ? data.ammo : MAX_ARROWS;
          setArrows(this.ammo);
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
            [0, 1].forEach((copy) => {
              const spawnX = Phaser.Math.Clamp(obj.x + copy * 42, 24, map.widthInPixels - 24);
              const spawnY = Phaser.Math.Clamp(obj.y + copy * 26, 24, map.heightInPixels - 24);
              const monster = this.monsters.create(spawnX, spawnY, key).setDepth(8);
              monster.hp = key === 'treant' ? 3 : 2;
              monster.speed = key === 'treant' ? 27 : 36;
              monster.setData('spawnX', spawnX).setData('spawnY', spawnY).setCollideWorldBounds(true);
              monster.setData('kind', key);
              monster.play(key === 'treant' ? 'treant-walk' : 'mole-walk');
              monster.setTint((index + copy) % 2 ? 0xffffff : 0xfff3cf);
            });
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
              if (this.currentMapKey === 'forest-map-2') {
                if (scoreRef.current < TARGET_SCORE) {
                  setScorePop(`Encore ${TARGET_SCORE - scoreRef.current} points`);
                  window.setTimeout(() => setScorePop(null), 1200);
                  return;
                }
                this.setQuizPaused(true);
                setWon(true);
                return;
              }
              this.isChangingMap = true;
              const nextMapKey = this.currentMapKey === 'forest-map' ? 'forest-map-2' : 'forest-map';
              const nextSpawn = nextMapKey === 'forest-map-2' ? { x: 60, y: 303 } : { x: 412, y: 430 };
              this.cameras.main.fadeOut(220, 8, 47, 35);
              this.time.delayedCall(230, () => this.scene.restart({ mapKey: nextMapKey, spawn: nextSpawn, ammo: this.ammo }));
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

        reloadArrows() {
          this.ammo = MAX_ARROWS;
          setArrows(MAX_ARROWS);
          this.cameras.main.flash(180, 134, 239, 172, false);
        }

        update(time) {
          if (!this.player || this.isQuizPaused || !this.player.active) return;
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

          if ((virtual.has('Space') || this.space.isDown) && time - this.lastShot >= this.reloadMs) this.shoot(time);
          this.monsters.children.iterate((monster) => {
            if (!monster?.active) return;
            const distance = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);
            if (distance < 180) this.physics.moveToObject(monster, this.player, monster.speed);
            else if (distance > 240) this.physics.moveTo(monster, monster.getData('spawnX'), monster.getData('spawnY'), monster.speed * 0.5);
          });
        }

        shoot(time) {
          if (this.ammo <= 0) return;
          this.ammo -= 1;
          setArrows(this.ammo);
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
            const spawnX = monster.getData('spawnX');
            const spawnY = monster.getData('spawnY');
            const kind = monster.getData('kind');
            monster.destroy();
            setScore((value) => value + 100);
            setScorePop('+100 points');
            window.setTimeout(() => setScorePop(null), 900);
            this.time.delayedCall(5000, () => {
              const revived = this.monsters.create(spawnX, spawnY, kind).setDepth(8).setCollideWorldBounds(true);
              revived.hp = kind === 'treant' ? 3 : 2;
              revived.speed = kind === 'treant' ? 27 : 36;
              revived.setData('spawnX', spawnX).setData('spawnY', spawnY).setData('kind', kind);
              revived.play(kind === 'treant' ? 'treant-walk' : 'mole-walk');
            });
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

  const validateAnswer = (index) => {
    if (!question || feedback) return;
    const isCorrect = index === Number(question.correctIndex);
    if (isCorrect) {
      const nextStep = quizStepRef.current + 1;
      setFeedback({ ok: true, message: `Bonne réponse ${nextStep}/4` });
      window.setTimeout(() => {
        quizStepRef.current = nextStep;
        setFeedback(null);
        if (nextStep >= 4) {
          sceneRef.current?.reloadArrows();
          sceneRef.current?.setQuizPaused(false);
          questionOpenRef.current = false;
          setQuestion(null);
        } else setQuestion(quizPoolRef.current[nextStep]);
      }, 650);
    } else {
      setFeedback({ ok: false, message: 'Mauvaise réponse : aucune flèche. Il faut recommencer la recharge.' });
      setArrows(0);
      if (sceneRef.current) sceneRef.current.ammo = 0;
      window.setTimeout(() => {
        sceneRef.current?.setQuizPaused(false);
        questionOpenRef.current = false;
        setQuestion(null);
        setFeedback(null);
      }, 1200);
    }
  };

  const restart = () => {
    setHearts(3);
    setScore(0);
    scoreRef.current = 0;
    setArrows(MAX_ARROWS);
    setGameOver(false);
    questionOpenRef.current = false;
    sceneRef.current?.scene.restart();
  };

  const setVirtualKey = (code, pressed) => {
    if (pressed) virtualKeysRef.current.add(code);
    else virtualKeysRef.current.delete(code);
  };

  return (
    <div className="edu-rpg-shell" onContextMenu={(event) => event.preventDefault()} onSelect={(event) => event.preventDefault()}>
      <header className="edu-rpg-header">
        <div>
          <div className="edu-rpg-kicker">Aventure éducative · QCM du chapitre</div>
          <h1>La forêt des savoirs</h1>
        </div>
        <div className="edu-rpg-hud">
          <div className="edu-rpg-hearts" aria-label={`${hearts} cœurs`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < hearts ? 'active' : ''}>♥</span>)}</div>
          <strong>{score}/{TARGET_SCORE}</strong>
          <span>🏹 {arrows}/{MAX_ARROWS} flèches</span>
        </div>
        <button type="button" className="edu-rpg-exit" onClick={onExit}>✕ Quitter</button>
      </header>

      <main className="edu-rpg-stage" onContextMenu={(event) => event.preventDefault()}>
        <div ref={canvasHostRef} className="edu-rpg-canvas" />
        <div className="edu-rpg-help">Atteins la dernière porte avec {TARGET_SCORE} points · chaque ennemi rapporte 100 points.</div>
        {scorePop && <div className="edu-rpg-score-pop">{scorePop}</div>}
        <div className="edu-rpg-mobile-controls" onContextMenu={(event) => event.preventDefault()}>
          <div className="edu-rpg-dpad">
            {['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].map((code) => <button key={code} type="button" onPointerDown={(event) => { event.preventDefault(); setVirtualKey(code, true); }} onPointerUp={() => setVirtualKey(code, false)} onPointerCancel={() => setVirtualKey(code, false)}>{({ ArrowUp: '▲', ArrowLeft: '◀', ArrowDown: '▼', ArrowRight: '▶' })[code]}</button>)}
          </div>
          <div className="edu-rpg-actions">
            <button type="button" className="shoot" onPointerDown={(event) => { event.preventDefault(); setVirtualKey('Space', true); }} onPointerUp={() => setVirtualKey('Space', false)} onPointerCancel={() => setVirtualKey('Space', false)}>🏹<small>TIRER</small></button>
            <button type="button" className="reload" onClick={openQuestion}>↻<small>RECHARGER</small></button>
          </div>
        </div>

        {question && !gameOver && (
          <div className="edu-rpg-quiz-backdrop">
            <div className={`edu-rpg-quiz ${feedback ? (feedback.ok ? 'correct' : 'wrong') : ''}`}>
              <div className="edu-rpg-quiz-label">Recharge · question {quizStepRef.current + 1}/4</div>
              <h2>{question.question}</h2>
              <div className="edu-rpg-qcm-options">{(question.choices || []).map((choice, index) => <button key={index} type="button" disabled={Boolean(feedback)} onClick={() => validateAnswer(index)}>{choice}</button>)}</div>
              {feedback && <p>{feedback.message}</p>}
            </div>
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
        {won && <div className="edu-rpg-quiz-backdrop"><div className="edu-rpg-game-over"><div className="edu-rpg-quiz-label">Mission réussie</div><h2>Forêt maîtrisée !</h2><p>Tu as atteint la dernière porte avec {score} points.</p><button type="button" onClick={restart}>Rejouer</button><button type="button" className="secondary" onClick={onExit}>Retour aux jeux</button></div></div>}
      </main>
      <footer className="edu-rpg-credit">Code adapté de Phaser3 Simple RPG (MIT) · graphismes Tiny RPG Forest par Ansimuz (CC0).</footer>
    </div>
  );
}
