module.exports = Object.freeze({
  port: Number(process.env.PORT) || 3210,
  minPlayers: 6, maxPlayers: 8, initialHp: 100, initialSoldiers: 15,
  soldiersPerRound: 3, turnSeconds: process.env.ALLIANCES_DEV ? 12 : 30,
  totalRounds: 8, targetedDefenseMultiplier: 2,
  likesPerRound: 1, likesForBonus: 3, likeHpBonus: 5,
  denunciationHpCost: 10, loyaltySeconds: process.env.ALLIANCES_DEV ? 8 : 15,
  allianceChangeCosts: [0, 0, 2, 4, 8, 16],
  allianceChangeHpCost: 23,
  loyalty: { faithfulBoth: 15, betrayedFaithful: 25, betrayBoth: 10, betrayerSoldiers: 5 },
  statementMaxLength: 180,
  botThinkMs: 900,
  combat: { maxDamage: 35, damageScale: 18, breakthroughDamagePerSoldier: 0.5, minimumDamage: 1, balancedLossRate: 0.55 }
});
