window.addEventListener('message', function(event) {
    if (event.source !== window.parent || event.data?.type !== 'condagame:configure-lesson') return;
    var configuredGoal = Number(event.data.goal);
    if (Number.isFinite(configuredGoal)) Mario.LevelGemGoal = Math.max(0, Math.floor(configuredGoal));
});

/**
	State for actually playing a randomly generated level.
	Code by Rob Kleffner, 2011
*/

Mario.LevelState = function(difficulty, type) {
    this.LevelDifficulty = difficulty;
    this.LevelType = type;
    this.Level = null;
    this.Layer = null;
    this.BgLayer = [];

    this.Paused = false;
    this.Sprites = null;
    this.SpritesToAdd = null;
    this.SpritesToRemove = null;
    this.Camera = null;
    this.ShellsToCheck = null;
    this.FireballsToCheck = null;

    this.FontShadow = null;
    this.Font = null;

    this.TimeLeft = 0;
    this.StartTime = 0;
    this.FireballsOnScreen = 0;
    this.Tick = 0;

    this.Delta = 0;

	this.GotoMapState = false;
	this.GotoLoseState = false;
};

Mario.LevelState.prototype = new Enjine.GameState();

Mario.LevelState.prototype.Enter = function() {
    var levelGenerator = new Mario.LevelGenerator(320, 15), i = 0, scrollSpeed = 0, w = 0, h = 0, bgLevelGenerator = null;
    Mario.LevelGemGoal = Number.isFinite(Number(Mario.LevelGemGoal)) ? Math.max(0, Math.floor(Number(Mario.LevelGemGoal))) : 3;
    this.Level = levelGenerator.CreateLevel(this.LevelType, this.LevelDifficulty);
    window.parent.postMessage({ type: 'condagame:level-start' }, '*');
    Mario.LevelGems = 0;
    window.parent.postMessage({ type: 'condagame:gems', gems: 0, goal: Mario.LevelGemGoal }, '*');

    //play music here
    if (this.LevelType === Mario.LevelType.Overground) {
    	Mario.PlayOvergroundMusic();
    } else if (this.LevelType === Mario.LevelType.Underground) {
    	Mario.PlayUndergroundMusic();
    } else if (this.LevelType === Mario.LevelType.Castle) {
    	Mario.PlayCastleMusic();
    }

    this.Paused = false;
    this.Layer = new Mario.LevelRenderer(this.Level, 320, 240);
    this.Sprites = new Enjine.DrawableManager();
    this.Camera = new Enjine.Camera();
    this.Tick = 0;

    this.ShellsToCheck = [];
    this.FireballsToCheck = [];
    this.SpritesToAdd = [];
    this.SpritesToRemove = [];

    this.FontShadow = Mario.SpriteCuts.CreateBlackFont();
    this.Font = Mario.SpriteCuts.CreateWhiteFont();

    for (i = 0; i < 2; i++) {
        scrollSpeed = 4 >> i;
        w = ((((this.Level.Width * 16) - 320) / scrollSpeed) | 0) + 320;
        h = ((((this.Level.Height * 16) - 240) / scrollSpeed) | 0) + 240;
        bgLevelGenerator = new Mario.BackgroundGenerator(w / 32 + 1, h / 32 + 1, i === 0, this.LevelType);
        this.BgLayer[i] = new Mario.BackgroundRenderer(bgLevelGenerator.CreateLevel(), 320, 240, scrollSpeed);
    }

    Mario.MarioCharacter.Initialize(this);

    this.Sprites.Add(Mario.MarioCharacter);
    this.StartTime = 1;
    this.TimeLeft = 200;

	this.GotoMapState = false;
	this.GotoLoseState = false;
};

Mario.LevelState.prototype.Exit = function() {

    delete this.Level;
    delete this.Layer;
    delete this.BgLayer;
    delete this.Sprites;
    delete this.Camera;
    delete this.ShellsToCheck;
    delete this.FireballsToCheck;
    delete this.FontShadow;
    delete this.Font;
};

Mario.LevelState.prototype.CheckShellCollide = function(shell) {
    this.ShellsToCheck.push(shell);
};

Mario.LevelState.prototype.CheckFireballCollide = function(fireball) {
    this.FireballsToCheck.push(fireball);
};

Mario.LevelState.prototype.Update = function(delta) {
    var i = 0, j = 0, xd = 0, yd = 0, sprite = null, hasShotCannon = false, xCannon = 0, x = 0, y = 0,
        dir = 0, st = null, b = 0;

    this.Delta = delta;

    if (this.QuizWaiting) return;
    if (this.QuizKnockback) {
        var knockedCharacter = Mario.MarioCharacter;
        knockedCharacter.Facing = -1;
        knockedCharacter.XOld = knockedCharacter.X;
        knockedCharacter.X = Math.max(0, knockedCharacter.X - 10);
        this.KnockbackSteps--;
        this.Camera.X = Math.max(0, Math.min(this.Level.Width * 16 - 320, knockedCharacter.X - 160));
        if (this.KnockbackSteps <= 0 || knockedCharacter.X <= 0) {
            this.QuizKnockback = false;
            this.Paused = false;
            window.parent.postMessage({ type: 'condagame:knockback-complete' }, '*');
        }
        return;
    }

    this.TimeLeft -= delta;
    if ((this.TimeLeft | 0) === 0) {
        Mario.MarioCharacter.Die();
    }

    if (this.StartTime > 0) {
        this.StartTime++;
    }

    this.Camera.X = Mario.MarioCharacter.X - 160;
    if (this.Camera.X < 0) {
        this.Camera.X = 0;
    }
    if (this.Camera.X > this.Level.Width * 16 - 320) {
        this.Camera.X = this.Level.Width * 16 - 320;
    }

    this.FireballsOnScreen = 0;

    for (i = 0; i < this.Sprites.Objects.length; i++) {
        sprite = this.Sprites.Objects[i];
        if (sprite !== Mario.MarioCharacter) {
            xd = sprite.X - this.Camera.X;
            yd = sprite.Y - this.Camera.Y;
            if (xd < -64 || xd > 320 + 64 || yd < -64 || yd > 240 + 64) {
                this.Sprites.RemoveAt(i);
            } else {
                if (sprite instanceof Mario.Fireball) {
                    this.FireballsOnScreen++;
                }
            }
        }
    }

    if (this.Paused) {
        for (i = 0; i < this.Sprites.Objects.length; i++) {
            if (this.Sprites.Objects[i] === Mario.MarioCharacter) {
                this.Sprites.Objects[i].Update(delta);
            } else {
                this.Sprites.Objects[i].UpdateNoMove(delta);
            }
        }
    } else {
        this.Layer.Update(delta);
        this.Level.Update();

        hasShotCannon = false;
        xCannon = 0;
		this.Tick++;

        for (x = ((this.Camera.X / 16) | 0) - 1; x <= (((this.Camera.X + this.Layer.Width) / 16) | 0) + 1; x++) {
            for (y = ((this.Camera.Y / 16) | 0) - 1; y <= (((this.Camera.Y + this.Layer.Height) / 16) | 0) + 1; y++) {
                dir = 0;

                if (x * 16 + 8 > Mario.MarioCharacter.X + 16) {
                    dir = -1;
                }
                if (x * 16 + 8 < Mario.MarioCharacter.X - 16) {
                    dir = 1;
                }

                st = this.Level.GetSpriteTemplate(x, y);

                if (st !== null) {
                    if (st.LastVisibleTick !== this.Tick - 1) {
                        if (st.Sprite === null || !this.Sprites.Contains(st.Sprite)) {
                            st.Spawn(this, x, y, dir);
                        }
                    }

                    st.LastVisibleTick = this.Tick;
                }

                if (dir !== 0) {
                    b = this.Level.GetBlock(x, y);
                    if (((Mario.Tile.Behaviors[b & 0xff]) & Mario.Tile.Animated) > 0) {
                        if ((((b % 16) / 4) | 0) === 3 && ((b / 16) | 0) === 0) {
                            if ((this.Tick - x * 2) % 100 === 0) {
                                xCannon = x;
                                for (i = 0; i < 8; i++) {
                                    this.AddSprite(new Mario.Sparkle(this, x * 16 + 8, y * 16 + ((Math.random() * 16) | 0), Math.random() * dir, 0, 0, 1, 5));
                                }
                                this.AddSprite(new Mario.BulletBill(this, x * 16 + 8 + dir * 8, y * 16 + 15, dir));
                                hasShotCannon = true;
                            }
                        }
                    }
                }
            }
        }

        if (hasShotCannon) {
            Enjine.Resources.PlaySound("cannon");
        }

        for (i = 0; i < this.Sprites.Objects.length; i++) {
            this.Sprites.Objects[i].Update(delta);
        }

        for (i = 0; i < this.Sprites.Objects.length; i++) {
            this.Sprites.Objects[i].CollideCheck();
        }

        for (i = 0; i < this.ShellsToCheck.length; i++) {
            for (j = 0; j < this.Sprites.Objects.length; j++) {
                if (this.Sprites.Objects[j] !== this.ShellsToCheck[i] && !this.ShellsToCheck[i].Dead) {
                    if (this.Sprites.Objects[j].ShellCollideCheck(this.ShellsToCheck[i])) {
                        if (Mario.MarioCharacter.Carried === this.ShellsToCheck[i] && !this.ShellsToCheck[i].Dead) {
                            Mario.MarioCharacter.Carried = null;
                            this.ShellsToCheck[i].Die();
                        }
                    }
                }
            }
        }
        this.ShellsToCheck.length = 0;

        for (i = 0; i < this.FireballsToCheck.length; i++) {
            for (j = 0; j < this.Sprites.Objects.length; j++) {
                if (this.Sprites.Objects[j] !== this.FireballsToCheck[i] && !this.FireballsToCheck[i].Dead) {
                    if (this.Sprites.Objects[j].FireballCollideCheck(this.FireballsToCheck[i])) {
                        this.FireballsToCheck[i].Die();
                    }
                }
            }
        }

        this.FireballsToCheck.length = 0;
    }

    this.Sprites.AddRange(this.SpritesToAdd);
    this.Sprites.RemoveList(this.SpritesToRemove);
    this.SpritesToAdd.length = 0;
    this.SpritesToRemove.length = 0;

    this.Camera.X = (Mario.MarioCharacter.XOld + (Mario.MarioCharacter.X - Mario.MarioCharacter.XOld) * delta) - 160;
    this.Camera.Y = (Mario.MarioCharacter.YOld + (Mario.MarioCharacter.Y - Mario.MarioCharacter.YOld) * delta) - 120;
};

Mario.LevelState.prototype.Draw = function(context) {
    var i = 0, time = 0, t = 0;

    if (this.Camera.X < 0) {
        this.Camera.X = 0;
    }
    if (this.Camera.Y < 0) {
        this.Camera.Y = 0;
    }
    if (this.Camera.X > this.Level.Width * 16 - 320) {
        this.Camera.X = this.Level.Width * 16 - 320;
    }
    if (this.Camera.Y > this.Level.Height * 16 - 240) {
        this.Camera.Y = this.Level.Height * 16 - 240;
    }

    for (i = 0; i < 2; i++) {
        this.BgLayer[i].Draw(context, this.Camera);
    }

    context.save();
    context.translate(-this.Camera.X, -this.Camera.Y);
    for (i = 0; i < this.Sprites.Objects.length; i++) {
        if (this.Sprites.Objects[i].Layer === 0) {
            this.Sprites.Objects[i].Draw(context, this.Camera);
        }
    }
    context.restore();

    this.Layer.Draw(context, this.Camera);
    this.Layer.DrawExit0(context, this.Camera, Mario.MarioCharacter.WinTime === 0);

    Object.keys(this.Level.QuizBoxes || {}).forEach(function(key) {
        if (!this.Level.QuizBoxes[key]) return;
        var parts = key.split(','), bx = Number(parts[0]) * 16 - this.Camera.X + 8, by = Number(parts[1]) * 16 - this.Camera.Y + 8;
        context.save();
        context.shadowColor = '#36e8ff';
        context.shadowBlur = 7;
        context.fillStyle = '#04c9e8';
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(bx, by - 8); context.lineTo(bx + 6, by - 2); context.lineTo(bx + 4, by + 5);
        context.lineTo(bx, by + 8); context.lineTo(bx - 4, by + 5); context.lineTo(bx - 6, by - 2); context.closePath();
        context.fill(); context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = '#a8fbff';
        context.beginPath();
        context.moveTo(bx, by - 6); context.lineTo(bx + 2, by - 2); context.lineTo(bx, by + 4);
        context.lineTo(bx - 2, by - 2); context.closePath();
        context.fill();
        context.restore();
    }, this);

    context.save();
    context.translate(-this.Camera.X, -this.Camera.Y);
    for (i = 0; i < this.Sprites.Objects.length; i++) {
        if (this.Sprites.Objects[i].Layer === 1) {
            this.Sprites.Objects[i].Draw(context, this.Camera);
        }
    }
    context.restore();

    this.Layer.DrawExit1(context, this.Camera);

    this.DrawStringShadow(context, "MARIO " + Mario.MarioCharacter.Lives, 0, 0);
    this.DrawStringShadow(context, "00000000", 0, 1);
    this.DrawStringShadow(context, "COIN", 10, 0);
    this.DrawStringShadow(context, " " + Mario.MarioCharacter.Coins, 10, 1);
    context.save();
    context.font = "bold 8px monospace";
    context.textBaseline = "top";
    context.lineWidth = 2;
    context.strokeStyle = "#10231d";
    context.fillStyle = "#39ff14";
    context.strokeText("GEMS", 18 * 8 + 4, 4);
    context.fillText("GEMS", 18 * 8 + 4, 4);
    context.strokeText((Mario.LevelGems || 0) + "/" + (Mario.LevelGemGoal || 3), 18 * 8 + 4, 18);
    context.fillText((Mario.LevelGems || 0) + "/" + (Mario.LevelGemGoal || 3), 18 * 8 + 4, 18);
    context.restore();
    this.DrawStringShadow(context, "WORLD", 26, 0);
    this.DrawStringShadow(context, " " + Mario.MarioCharacter.LevelString, 26, 1);
    this.DrawStringShadow(context, "TIME", 34, 0);
    time = this.TimeLeft | 0;
    if (time < 0) {
        time = 0;
    }
    this.DrawStringShadow(context, " " + time, 34, 1);

    if (this.StartTime > 0) {
        t = this.StartTime + this.Delta - 2;
        t = t * t * 0.6;
        this.RenderBlackout(context, 160, 120, t | 0);
    }

    if (Mario.MarioCharacter.WinTime > 0) {
		if ((Mario.LevelGems || 0) < (Mario.LevelGemGoal || 3)) {
			Mario.MarioCharacter.WinTime = 0;
			if (!this.GemGoalWarningSent) {
				this.GemGoalWarningSent = true;
				window.parent.postMessage({ type: 'condagame:need-gems', gems: Mario.LevelGems || 0, goal: Mario.LevelGemGoal || 3 }, '*');
			}
			return;
		}
     Mario.StopMusic();
        t = Mario.MarioCharacter.WinTime + this.Delta;
        t = t * t * 0.2;

        if (t > 900) {
            Mario.GlobalMapState.LevelWon();
            this.GotoMapState = true;
            window.parent.postMessage({ type: 'condagame:level-won' }, '*');
        }

        this.RenderBlackout(context, ((Mario.MarioCharacter.XDeathPos - this.Camera.X) | 0), ((Mario.MarioCharacter.YDeathPos - this.Camera.Y) | 0), (320 - t) | 0);
    }

    if (Mario.MarioCharacter.DeathTime > 0) {
    	Mario.StopMusic();
        t = Mario.MarioCharacter.DeathTime + this.Delta;
        t = t * t * 0.1;

        if (t > 900) {
            //TODO: goto map with level lost
			Mario.MarioCharacter.Lives--;
			this.GotoMapState = true;
			if (Mario.MarioCharacter.Lives <= 0) {
				this.GotoLoseState = true;
			}
        }

        this.RenderBlackout(context, ((Mario.MarioCharacter.XDeathPos - this.Camera.X) | 0), ((Mario.MarioCharacter.YDeathPos - this.Camera.Y) | 0), (320 - t) | 0);
    }
};

Mario.LevelState.prototype.DrawStringShadow = function(context, string, x, y) {
    this.Font.Strings[0] = { String: string, X: x * 8 + 4, Y: y * 8 + 4 };
    this.FontShadow.Strings[0] = { String: string, X: x * 8 + 5, Y: y * 8 + 5 };
    this.FontShadow.Draw(context, this.Camera);
    this.Font.Draw(context, this.Camera);
};

Mario.LevelState.prototype.RenderBlackout = function(context, x, y, radius) {
    if (radius > 320) {
        return;
    }

    var xp = [], yp = [], i = 0;
    for (i = 0; i < 16; i++) {
        xp[i] = x + (Math.cos(i * Math.PI / 15) * radius) | 0;
        yp[i] = y + (Math.sin(i * Math.PI / 15) * radius) | 0;
    }
    xp[16] = 0;
    yp[16] = y;
    xp[17] = 0;
    yp[17] = 240;
    xp[18] = 320;
    yp[18] = 240;
    xp[19] = 320;
    yp[19] = y;

    context.fillStyle = "#000";
    context.beginPath();
    context.moveTo(xp[19], yp[19]);
    for (i = 18; i >= 0; i--) {
        context.lineTo(xp[i], yp[i]);
    }
    context.closePath();
    context.fill();

    for (i = 0; i < 16; i++) {
        xp[i] = x - (Math.cos(i * Math.PI / 15) * radius) | 0;
        yp[i] = y - (Math.sin(i * Math.PI / 15) * radius) | 0;
    }
    //cure a strange problem where the circle gets cut
    yp[15] += 5;

    xp[16] = 320;
    yp[16] = y;
    xp[17] = 320;
    yp[17] = 0;
    xp[18] = 0;
    yp[18] = 0;
    xp[19] = 0;
    yp[19] = y;

    context.fillStyle = "#000";
    context.beginPath();
    context.moveTo(xp[0], yp[0]);
    for (i = 0; i <= xp.length - 1; i++) {
        context.lineTo(xp[i], yp[i]);
    }
    context.closePath();
    context.fill();
};

Mario.LevelState.prototype.AddSprite = function(sprite) {
    this.Sprites.Add(sprite);
};

Mario.LevelState.prototype.RemoveSprite = function(sprite) {
    this.Sprites.Remove(sprite);
};

Mario.LevelState.prototype.Bump = function(x, y, canBreakBricks) {
    var block = this.Level.GetBlock(x, y), xx = 0, yy = 0;

    var quizKey = `${x},${y}`;
    if (this.Level.QuizBoxes && this.Level.QuizBoxes[quizKey] && !this.QuizWaiting) {
        this.QuizWaiting = true;
        this.ActiveQuizBox = { x: x, y: y, key: quizKey };
        this.Paused = true;
        window.condaQuizActive = true;
        var state = this;
        window.parent.postMessage({ type: 'condagame:question-box' }, '*');
        window.condaAnswerQuestion = function(answer) {
            if (!state.QuizWaiting || !state.ActiveQuizBox) return;
            state.QuizWaiting = false;
            state.Paused = false;
            window.condaQuizActive = false;
            if (answer.noQuestion) {
                state.Level.SetBlock(state.ActiveQuizBox.x, state.ActiveQuizBox.y, 4);
                state.Level.QuizBoxes[state.ActiveQuizBox.key] = false;
                state.ActiveQuizBox = null;
                return;
            }
            if (answer.correct) {
                state.Level.SetBlock(state.ActiveQuizBox.x, state.ActiveQuizBox.y, 4);
                state.Level.QuizBoxes[state.ActiveQuizBox.key] = false;
                Mario.LevelGems = Math.min(Mario.LevelGemGoal, Mario.LevelGems + 1);
                window.parent.postMessage({ type: 'condagame:gems', gems: Mario.LevelGems, goal: Mario.LevelGemGoal }, '*');
                Enjine.Resources.PlaySound('coin');
            } else {
                state.Level.SetBlock(state.ActiveQuizBox.x, state.ActiveQuizBox.y, 4);
                
                Mario.LevelGems = Math.max(0, Mario.LevelGems - 1);
                window.parent.postMessage({ type: 'condagame:gems', gems: Mario.LevelGems, goal: Mario.LevelGemGoal }, '*');
                window.parent.postMessage({ type: 'condagame:wrong-answer', gems: Mario.LevelGems, goal: Mario.LevelGemGoal }, '*');
                Enjine.Resources.PlaySound('bump');
                state.QuizKnockback = true;
                state.KnockbackSteps = 64;
                state.Paused = true;
                Mario.MarioCharacter.Facing = -1;
            }
            state.ActiveQuizBox = null;
        };
        return;
    }

    if ((Mario.Tile.Behaviors[block & 0xff] & Mario.Tile.Bumpable) > 0) {
        this.BumpInto(x, y - 1);
        this.Level.SetBlock(x, y, 4);
        this.Level.SetBlockData(x, y, 4);

        if ((Mario.Tile.Behaviors[block & 0xff] & Mario.Tile.Special) > 0) {
            Enjine.Resources.PlaySound("sprout");
            if (!Mario.MarioCharacter.Large) {
                this.AddSprite(new Mario.Mushroom(this, x * 16 + 8, y * 16 + 8));
            } else {
                this.AddSprite(new Mario.FireFlower(this, x * 16 + 8, y * 16 + 8));
            }
        } else {
            Mario.MarioCharacter.GetCoin();
            Enjine.Resources.PlaySound("coin");
            this.AddSprite(new Mario.CoinAnim(this, x, y));
        }
    }

    if ((Mario.Tile.Behaviors[block & 0xff] & Mario.Tile.Breakable) > 0) {
        this.BumpInto(x, y - 1);
        if (canBreakBricks) {
            Enjine.Resources.PlaySound("breakblock");
            this.Level.SetBlock(x, y, 0);
            for (xx = 0; xx < 2; xx++) {
                for (yy = 0; yy < 2; yy++) {
                    this.AddSprite(new Mario.Particle(this, x * 16 + xx * 8 + 4, y * 16 + yy * 8 + 4, (xx * 2 - 1) * 4, (yy * 2 - 1) * 4 - 8));
                }
            }
        }
    }
};

Mario.LevelState.prototype.BumpInto = function(x, y) {
    var block = this.Level.GetBlock(x, y), i = 0;
    if (((Mario.Tile.Behaviors[block & 0xff]) & Mario.Tile.PickUpable) > 0) {
        Mario.MarioCharacter.GetCoin();
        Enjine.Resources.PlaySound("coin");
        this.Level.SetBlock(x, y, 0);
        this.AddSprite(new Mario.CoinAnim(x, y + 1));
    }

    for (i = 0; i < this.Sprites.Objects.length; i++) {
        this.Sprites.Objects[i].BumpCheck(x, y);
    }
};

Mario.LevelState.prototype.CheckForChange = function(context) {
	if (this.GotoLoseState) {
		context.ChangeState(new Mario.LoseState());
	}
	else {
		if (this.GotoMapState) {
			context.ChangeState(Mario.GlobalMapState);
		}
	}
};
