(function installPossessionCombat() {
  let scene;
  let enemy;
  let projectile;
  let ally;
  let possessionReady = false;
  let fragileAlly = false;
  let enemyHp = 1;
  let allyHp = 0;
  let allyAttackAt = 0;
  let enemyAttackAt = 0;
  let boundScene;

  const send = (type, payload = {}) => window.parent.postMessage({ source: 'condamine-game', type, ...payload }, '*');
  const getPlayer = () => scene?.player;
  const addEnemy = () => {
    const player = getPlayer();
    if (!player || enemy?.active) return;
    enemy = scene.add.container(player.x + 58, player.y, [
      scene.add.rectangle(0, 0, 22, 25, 0x8b3fc7).setStrokeStyle(3, 0x301849),
      scene.add.circle(-5, -3, 2, 0xffffff), scene.add.circle(5, -3, 2, 0xffffff),
      scene.add.rectangle(0, 7, 13, 3, 0x381c46),
    ]).setDepth(35);
    enemyHp = 2;
  };
  const shoot = () => {
    const player = getPlayer();
    if (!player) return;
    addEnemy();
    if (projectile?.active) return;
    const direction = player.flipX ? -1 : 1;
    projectile = scene.add.circle(player.x + direction * 15, player.y - 5, 4, 0xffdf4d)
      .setStrokeStyle(2, 0xff9d24).setDepth(40);
    projectile.combatDirection = direction;
  };
  const removeAlly = () => {
    ally?.destroy();
    ally = null;
    allyHp = 0;
    fragileAlly = false;
    possessionReady = false;
    addEnemy();
    send('combat-summon-died');
  };
  const tick = (time = 0) => {
    const player = getPlayer();
    if (!player) return;
    if (projectile?.active && enemy?.active) {
      projectile.x += projectile.combatDirection * 5;
      if (Math.abs(projectile.x - enemy.x) < 13 && Math.abs(projectile.y - enemy.y) < 18) {
        projectile.destroy(); projectile = null;
        send('combat-possession-hit');
      } else if (Math.abs(projectile.x - player.x) > 240) {
        projectile.destroy(); projectile = null;
      }
    }
    if (ally?.active) {
      if (enemy?.active) {
        const distance = enemy.x - ally.x;
        ally.x += Math.sign(distance) * Math.min(Math.abs(distance), 1.5);
        ally.y += (enemy.y - 5 - ally.y) * 0.08;
        if (Math.abs(distance) < 20 && time >= allyAttackAt) {
          enemyHp -= 1;
          allyAttackAt = time + 650;
          if (enemyHp <= 0) { enemy.destroy(); enemy = null; }
        }
        if (Math.abs(distance) < 17 && time >= enemyAttackAt) {
          allyHp -= 1;
          enemyAttackAt = time + 1600;
          send('combat-summon-hurt');
          if (allyHp <= 0) removeAlly();
        }
      } else {
        ally.setPosition(player.x + (player.flipX ? 20 : -20), player.y - 5);
      }
    }
  };
  const makeAlly = (stage, wrong) => {
    enemy?.destroy(); enemy = null;
    const player = getPlayer();
    if (!player) return;
    ally?.destroy();
    const scale = wrong ? 0.5 : 1 + (Math.max(1, stage) - 1) * 0.2;
    ally = scene.add.star(player.x - 20, player.y - 5, 5, 6 * scale, 11 * scale, wrong ? 0xf97316 : 0x4ade80)
      .setStrokeStyle(2, 0x143c2a).setDepth(36);
    allyHp = wrong ? 1 : Math.max(1, stage);
    allyAttackAt = scene.time.now || 0;
    enemyAttackAt = allyAttackAt + 1500;
    fragileAlly = wrong;
    possessionReady = false;
    addEnemy();
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.source !== 'condamine') return;
    if (event.data.type === 'combat-cast-possession') shoot();
    if (event.data.type === 'combat-possession-complete') {
      possessionReady = true;
      if (enemy?.active) enemy.list?.forEach?.((part) => part.setFillStyle?.(0x38bdf8));
      send('combat-summon-ready');
    }
    if (event.data.type === 'combat-summon-stage') makeAlly(Number(event.data.stage) || 0, Boolean(event.data.wrong));
    if (event.data.type === 'combat-summon-attack' && ally?.active && enemy?.active) {
      enemyHp -= 1;
      if (enemyHp <= 0) { enemy.destroy(); enemy = null; }
    }
  });

  window.addEventListener('condamine-room-enter', (event) => {
    window.setTimeout(() => {
      scene = window.condamineGetGameScene?.();
      if (!scene) return;
      boundScene?.events?.off('update', tick);
      boundScene = scene;
      scene.events?.on('update', tick);
      enemy?.destroy(); enemy = null;
      projectile?.destroy(); projectile = null;
      ally?.destroy(); ally = null;
      possessionReady = false;
      if (String(event.detail?.level || '').toLowerCase().includes('dungeon')) addEnemy();
    }, 80);
  });

  const waitForScene = window.setInterval(() => {
    scene = window.condamineGetGameScene?.();
    if (!scene?.events || !getPlayer()) return;
    window.clearInterval(waitForScene);
    boundScene = scene;
    scene.events.on('update', tick);
  }, 200);
})();
