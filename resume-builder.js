'use strict';

!function(){
	
	var fps     = 60;
	var step    = 1/fps;
	var meter   = 24; // number of pixels per meter
	var gravity = 9.8 * meter;// acceleration due to gravity, m/s
	var jumpImpulse  = gravity/2 * fps;
	var flapImpulse  = gravity/3 * fps;
	var glideImpulse = gravity/3 * fps;
	var walkImpulse  = gravity/4 * fps;
	var walkmaxdx    = gravity;
	var maxdx   = gravity * 5;
	var maxdy   = gravity * 10;
	var groundHeight = 35;


	var ENTER    = 13;
	var ESC      = 27;
	var SPACE    = 32;
	var LEFT     = 37;
	var UP       = 38;
	var RIGHT    = 39;
	var DOWN     = 40;
	var KEY_A    = 65;
	var KEY_D    = 68;
	var KEY_G    = 71;
	var KEY_P    = 80;
	var KEY_S    = 83;
	var KEY_W    = 87;
	var KEY_X    = 88;
	var COMMA    = 188;
	var PERIOD   = 190;

	var yellowBird = {
		sy: [ 1, 1, 1, 1, 0,  0,  0],
		sx: [ 1,23,46,70,90,113,140],
		sw: [19,19,19,19,19, 19, 19],
		sh: [19,19,19,19,19, 19, 19] // or 13 for flying frames
	};
	var blueBird = {
		sy: [28,28,28,28,27, 28, 28],
		sx: [ 1,23,46,70,90,113,140],
		sw: [19,19,19,19,19, 19, 19],
		sh: [19,19,19,19,19, 19, 19]
	};
	var greenBird = {
		sy: [50,50,50,49,48, 50, 50],
		sx: [ 0,23,46,69,90,113,140],
		sw: [19,19,19,19,19, 19, 19],
		sh: [19,19,19,19,19, 19, 19]
	};
	var burst = {
		sy: [ 90, 90],
		sx: [111,129],
		sw: [ 11, 11],
		sh: [ 11, 11]
	}
	var creatures = [yellowBird, blueBird, greenBird];


	var link     = document.getElementById('resume-content');
	var arena    = document.getElementById('arena');
	var arenaSky = document.querySelector('#arena .sky');
	var arenaGround  = document.querySelector('#arena .ground');
	var spritesheet  = new Image();
	var monsterCount = 1;
	var drops    = document.createElement('div'); // Chunks of resume to insert when the player does good things
	var canvas   = document.getElementById('canvas');
	var ctx      = canvas.getContext('2d');
	var width    = canvas.width  = window.innerWidth;
	var height   = canvas.height = window.innerHeight;
	var skyHeight= arena.scrollHeight - groundHeight;
	var landWidth= arena.clientWidth;
	var player   = {};
	var monsters = [];
	var pause    = false;
	var godMode  = false;
	var debug    = false;

	var score    = 0;
	var topScore = 0;


	var dt = 0;
	var now = window.performance.now();
	var last = now;

	waitForContent()
	.then(loadContent)
	.then(initGame)
	.then(frame);

	//-------------------------------------------------------------------------
	// UTILITIES
	//-------------------------------------------------------------------------

	function clamp(val, min, max) {
		return Math.max(min, Math.min(max, val));
	}

	function wrap(val, min, max) {
		return val < min ? max : (val > max ? min: val);
	}

	function overlap(entity1, entity2) {
		var r = (entity2.w + entity1.w) / 2 // Minimum distance between centers for a collision to occur
		var cv = {x: entity2.x - entity1.x, y: entity2.y - entity1.y}; // Collision vector
		cv.d = Math.sqrt(cv.x * cv.x + cv.y * cv.y); // distance
		var s = cv.d - r; // separation distance

		if (s > 0) return null; // No collision

		// normalize our collision vector to get the collision normal vector
		var collNrml = { // Collision Normal Vector
			x: cv.x / cv.d,
			y: cv.y / cv.d
		};
		var relVel = { // Relative Velocity Vector
			x: entity2.dx - entity1.dx, 
			y: entity2.dy - entity1.dy
		};
		var velRelNrml = { // Velocity Relative to Normal Vector
			x: relVel.x * collNrml.x,
			y: relVel.y * collNrml.y
		}
		velRelNrml.d = Math.sqrt(velRelNrml.x * velRelNrml.x + velRelNrml.y * velRelNrml.y);
		
		var impulse = -0.75 * // coefficient of restitude == 0.5, all entities have mass == 1, -(1+0.5)/2 == 0.75
						(relVel.x * collNrml.x + relVel.y * collNrml.y) /
						(collNrml.x * collNrml.x + collNrml.y * collNrml.y);
		var collImp = { // Collision Impulse Vector
			x: collNrml.x * impulse,
			y: collNrml.y * impulse
		};
		return collImp;
	}


	// t: current time
	// b: start value
	// c: change in value
	// d: duraiton
	Math.linearTween = function (t, b, c, d) {
		return c*t/d + b;
	};
	Math.easeInQuadTween = function (t, b, c, d) {
		t /= d;
		return c*t*t + b;
	};
	Math.easeOutQuadTween = function (t, b, c, d) {
		t /= d;
		return -c*t*(t-2) + b;
	};
	Math.easeInOutQuadTween = function (t, b, c, d) {
		t /= d/2;
		if (t < 1) return c/2*t*t + b;
		--t;
		return -c/2 * (t*(t-2) - 1) + b;
	};

	//-------------------------------------------------------------------------
	// SETUP
	//-------------------------------------------------------------------------

	function waitForContent(){
		// Wait for content to be retreived by the browser
		return new Promise(function (resolve, reject){
			spritesheet.src = 'spritesheet.png'; // Should wait for this too... TODO
			var req = new XMLHttpRequest();
			req.addEventListener('load', resolve);
			req.open('GET', '/resume.html');
			req.send();
		});
	}

	function loadContent(xhr){
		// We pull out all of the tags (ignoring raw text nodes) from the resume
		// and stick those into our drops. The drops then are placed into the
		// arena at a time as needed
		var resume = document.createElement('div');
		resume.innerHTML = xhr.currentTarget.response;
		
		while (resume.firstChild){
			var node = resume.removeChild(resume.firstChild);
			if (node.nodeType == Node.ELEMENT_NODE)
				drops.appendChild(node);
		}

		if (drops.firstChild) {
			arenaSky.appendChild(drops.firstChild);
		}
	}

	function initGame(){
		initPlayer();
		initRandomMonster();
		document.addEventListener('keydown',   function(event) { return handleInput(event, event.keyCode, true)}, false);
		document.addEventListener('keyup',     function(event) { return handleInput(event, event.keyCode,false)}, false);
		document.addEventListener('touchstart',function(event) { return handleInput(event, UP,  true)}, false);
		document.addEventListener('touchend',  function(event) { return handleInput(event, UP, false)}, false);
		document.addEventListener('wheel',     function(event) {
			pause = true;
			arena.classList.add('mouse-scrolling');
		});
	}

	function initPlayer() {
		var sprite = creatures[~~(Math.random() * 2)];
		player = setupEntity({
			type: 'player',
			sprite: sprite,
			x: landWidth * 0.5,
			y: skyHeight * 0.8,
			w: 60,
			h: 60,
			collisions: false
		});
	}

	function initDebugMonster(y) {
		var sprite = creatures[2];
		var monster = setupEntity({
			type: 'monster',
			sprite: sprite,
			ai: debugMonster,
			y: y || 0,
			debug: y,
			w: 60,
			h: 60,
			gravity: 0,
			collisions: false
		});
		monsters.push(monster);
	}

	function initRandomMonster() {
		var sprite = creatures[2];
		var monster = setupEntity({
			type: 'monster',
			sprite: sprite,
			ai: randomMover,
			x: landWidth * Math.random(),
			y: skyHeight * 0.2 * (Math.random() + 1),
			w: 60,
			h: 60,
			maxdx: maxdx * 0.8,
			collisions: true
		});
		monsters.push(monster);
	}

	function setupEntity(obj) {
		var entity = {};
		obj             = obj || {};

		entity.x          = +obj.x || 0;
		entity.y          = +obj.y || 0;
		entity.dx         = +obj.dx || 0;
		entity.dy         = +obj.dy || 0;
		entity.w          = +obj.w || 0;
		entity.h          = +obj.h || 0;
		entity.isMonster  = obj.type === 'monster';
		entity.isPlayer   = obj.type === 'player';
		entity.isTreasure = obj.type === 'treasure';
		entity.sprite     = obj.sprite;
		entity.ai         = obj.ai ? obj.ai.bind(entity) : undefined;
		entity.start      = { x: +obj.x || 0, y: +obj.y || 0 };
		entity.gravity    = obj.gravity !== undefined ? obj.gravity : gravity;
		entity.maxdx      = obj.maxdx   !== undefined ? obj.maxdx   : maxdx;
		entity.maxdy      = obj.maxdy   !== undefined ? obj.maxdy   : maxdy;
		entity.jumpImpulse  = obj.jumpImpulse  !== undefined ? obj.jumpImpulse  : jumpImpulse;
		entity.flapImpulse  = obj.flapImpulse  !== undefined ? obj.flapImpulse  : flapImpulse;
		entity.glideImpulse = obj.glideImpulse !== undefined ? obj.glideImpulse : glideImpulse;
		entity.walkImpulse  = obj.walkImpulse  !== undefined ? obj.walkImpulse  : walkImpulse;
		entity.walkmaxdx    = obj.walkmaxdx    !== undefined ? obj.walkmaxdx    : walkmaxdx  ;
		entity.debug      = obj.debug;
		entity.collisions = obj.collisions;
		return entity;
	}





	//-------------------------------------------------------------------------
	// UPDATE LOOP
	//-------------------------------------------------------------------------


	function handleInput(event, key, isDown) {
		switch (key){
			case UP:
			case ENTER:
			case KEY_W:
				if (!isDown) {
					player.lastImpulse = null;
					return;
				}
				if (player.death && now - player.death > 500){
					// Respawn with a random bird
					initPlayer();
				} else {
					player.jumpflap = true;
					player.collisions = true;
				}
				arena.classList.remove('mouse-scrolling');
				if (pause) {
					pause = false;
					frame();
				}
				event.preventDefault();
				return false;
			case RIGHT:
			case KEY_D:
				if (!isDown) {
					player.lastImpulse = null;
					return;
				}
				if (player.death && now - player.death > 500){
					// Respawn with a random bird
					initPlayer();
				} else {
					player.goRight = true;
					player.collisions = true;
				}
				arena.classList.remove('mouse-scrolling');
				if (pause) {
					pause = false;
					frame();
				}
				event.preventDefault();
				return false;
			case LEFT:
			case KEY_A:
				if (!isDown) {
					player.lastImpulse = null;
					return;
				}
				if (player.death && now - player.death > 500){
					// Respawn with a random bird
					initPlayer();
				} else {
					player.goLeft = true;
					player.collisions = true;
				}
				arena.classList.remove('mouse-scrolling');
				if (pause) {
					pause = false;
					frame();
				}
				event.preventDefault();
				return false;


			case ESC:
			case KEY_P:
				if (!isDown) return;
				pause = !pause;
				last = window.performance.now();
				if (!pause) frame(); // Game was unpaused
				event.preventDefault();
				return false;

			case KEY_G:
				if (!isDown) return;
				godMode = !godMode;
				event.preventDefault();
				return false;
			case SPACE:
				if (!isDown) return;
				addChunk();
				event.preventDefault();
				return false;
			case COMMA:
				if (!isDown) return;
				player.x--;
				event.preventDefault();
				return false;
			case PERIOD:
				if (!isDown) return;
				player.x++;
				event.preventDefault();
				return false;
			case KEY_X:
				if (!isDown) return;
				debug = !debug;
				if (debug){
					monsters = [];
					initDebugMonster();
					initDebugMonster(100);
					initDebugMonster(200);
					initDebugMonster(400);
					initDebugMonster(800);
					initDebugMonster(1000);
				} else {
					monsters = [];
					initRandomMonster();
				}
				event.preventDefault();
				return false;
			default:
				console.log('Key:', key, 'isDown:', isDown);
		}
	}

	function addChunk(){
		if (drops.firstChild) {
			var oldSkyHeight = skyHeight;
			arena.insertBefore(drops.firstChild, arenaGround);
			skyHeight = arena.scrollHeight - groundHeight;
		}
	}

	function update(dt) {
		updatePlayer(dt);
		updateMonsters(dt);
		handleCollisions();
		buryTheDead();
	}

	function updatePlayer(dt) {
		updateEntity(player, dt);
	}

	function updateMonsters(dt) {
		monsters.forEach(function (monster){
			monster.ai();
			updateEntity(monster, dt);
		});
	}

	function updateEntity(entity, dt) {
		entity.ddx = 0;
		entity.ddy = entity.gravity;

		if (!entity.death) {
			if (entity.jumpflap) {
				entity.ddy -= entity.airborne ? entity.flapImpulse : entity.jumpImpulse;
				entity.jumpflap = false;
				entity.lastImpulse = now;
			}

			if (entity.goRight) {
				entity.goRight = false;
				entity.lastImpulse = now;
				if (entity.airborne) {
					entity.ddx += entity.glideImpulse;
				} else if (entity.dx < entity.walkmaxdx) {
					entity.dx = clamp(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx); // Apply what impulse we have thus far and then add what walk imp we can
					entity.dx = clamp(entity.dx + (dt * entity.walkImpulse), -entity.walkmaxdx, entity.walkmaxdx);
					entity.ddx = 0;
					entity.walkingVelocity = entity.dx;
					entity.lastWalked = entity.lastImpulse;
				}
			}
			
			if (entity.goLeft) {
				entity.goLeft = false;
				entity.lastImpulse = now;
				if (entity.airborne) {
					entity.ddx -= entity.glideImpulse;
				} else if (entity.dx > -entity.walkmaxdx) {
					entity.dx = clamp(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx); // Apply what impulse we have thus far and then add what walk imp we can
					entity.dx = clamp(entity.dx + (dt * -entity.walkImpulse), -entity.walkmaxdx, entity.walkmaxdx);
					entity.ddx = 0;
					entity.walkingVelocity = entity.dx;
					entity.lastWalked = entity.lastImpulse;
				}
			}	
		}

		entity.dx = clamp(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
		entity.dy = clamp(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);
		entity.x  = wrap (entity.x  + (dt * entity.dx), 0, landWidth);
		entity.y  = clamp(entity.y  + (dt * entity.dy), entity.h/2, skyHeight - entity.h/2);

		// Adjust the facing of the entity.
		// If the entity comes to a rest (dx == 0), the current facing will be retained
		if (entity.dx < 0){
			entity.facingLeft = true;
		} else if (entity.dx > 0) {
			entity.facingLeft = false;
		}


		// Boundry Collision Detection
		if (entity.y >= skyHeight - entity.h/2) {
			// On the ground. Stop all downward motion.
			entity.dy = 0;

			if (entity.airborne) {
				// Just landed
				entity.airborne = false;
				entity.walkingVelocity = entity.dx;
				entity.lastWalked = now;
			}

			// Adjust walking velocity
			if (entity.dx !== 0) {
				var t = now - entity.lastWalked;
				var b = entity.walkingVelocity;
				var c = entity.walkingVelocity * -1;
				var d = 1000;

				if (t >= d) {
					entity.dx = 0;
				} else {
					entity.dx = Math.easeInQuadTween(t, b, c, d);
				}
			}
		} else {
			entity.airborne = true;
			if (entity.y <= entity.h/2) {
				// Hit the top of the sky. Quickly slow down motion.
				entity.dy = entity.dy * 0.80;
			}
		}
		
	
	}

	function handleCollisions(){
		var p = player;
		if (p.death || !p.collisions) return; // Player is incorperal right now and cannot be touched

		monsters.forEach(function (m){
			if (m.death || !m.collisions || p.death || !p.collisions) return;
			var collisionImpulse = overlap(p, m);
			var loser;

			if (collisionImpulse) {
				p.dx -= 0.5 * collisionImpulse.x;
				p.dy -= 0.5 * collisionImpulse.y;
				m.dx += 0.5 * collisionImpulse.x;
				m.dy += 0.5 * collisionImpulse.y;

				// Player wins if bird is higher than or equal to the monster
				// And the player is facing the monster
				// The top of the sky is 0, so lower is better
				if (godMode || p.y <= m.y && ( (p.x < m.x && !p.facingLeft) || (p.x > m.x && p.facingLeft) )) {
					addChunk(); // Rewards!
					// kill monster
					loser = m;
					++score;
					if (score > topScore) topScore = score;
					// Create a new monster to replace the dead one.
					setTimeout(initRandomMonster, 2000 + Math.random() * 2000);
					if (monsterCount < 6) {
						// Add an aditional monster!
						++monsterCount;
						setTimeout(initRandomMonster, 3000 + Math.random() * 3000);
					}
				} else if (m.y <= p.y && ( (m.x < p.x && !m.facingLeft) || (m.x > p.x && m.facingLeft) )) {
					// kill player
					loser = p;
					score = 0;
				}

				if (loser){
					loser.death = now;
					loser.dx = 0;
					loser.dy = 0;
					loser.gravity = 0;
				}
			}
		});
	}

	function buryTheDead() {
		for (var i=0; i<monsters.length; ++i){
			if (monsters[i].death && now > monsters[i].death + 1000) {
				// remove the dead monster
				monsters.splice(i--,1);
			}
		}
	}



	//-------------------------------------------------------------------------
	// MONSTER AI
	//-------------------------------------------------------------------------

	function randomMover(){
		var action = Math.random();
		if (0 > (action -= 0.02)) {
			// Accelerate in the current direction
			if (!this.aiGoal) this.aiGoal = Math.random() < 0.5 ? LEFT : RIGHT;
			if (this.aiGoal == LEFT) {
				this.goLeft = true;
			} else {
				this.goRight = true;
			}
		} else if (0 > (action -= 0.04)) {
			// Fly higher
			this.jumpflap = true;
		} else if (0 > (action -= 0.005)) {
			// Switch directions
			this.aiGoal = Math.random() < 0.5 ? LEFT : RIGHT;
		} else {
			// Do nothing
		}
	}

	function debugMonster(){
		this.x = 200;
		this.y = this.debug || player.y;
		this.collisions = false;
	}


	//-------------------------------------------------------------------------
	// RENDERING
	//-------------------------------------------------------------------------

	function render(dt) {;
		ctx.clearRect(0, 0, width, height);
		ctx.imageSmoothingEnabled = false;
		renderPlayer(dt);
		renderMonsters(dt);
		renderScore();

		if (debug) {
			ctx.fillStyle = 'rgba(0,0,0,0.75)';
			ctx.fillRect(75, 10, 100, 500);
			ctx.fillStyle = 'gold';
			ctx.font = '10px sans-serif';
			ctx.fillText('x:' + ~~player.x + ', dx:' + ~~player.dx, 10, 80);
			ctx.fillText('y:' + ~~player.y + ', dy:' + ~~player.dy, 10, 95);
			ctx.fillText(player.airborne ? 'airborne' : 'grounded', 10, 110);
			ctx.fillText('scroll top:' + arena.scrollTop,           10, 125);
			ctx.fillText('scroll height:' + arena.scrollHeight,     10, 140);
		}
	}


	function renderPlayer(dt){
		renderCreature(player, dt);
	}

	function renderMonsters(dt) {
		monsters.forEach(function (monster){
			renderCreature(monster, dt);
		});
	}

	function renderScore(){
		ctx.fillStyle = '#a99';
		ctx.font = '18px fantasy';
		ctx.fillText('BEST',   10, 20);
		ctx.fillText('SCORE',  10, 47);
		ctx.fillText(topScore, 90, 20);
		ctx.fillText(score   , 90, 47);
	}

	function renderCreature(entity, dt) {
		var sprite = entity.sprite;
		var animFrame = ~~(entity.x / (sprite.sw[0] / 4)) % 4;
		
		if (entity.death) {
			animFrame = ~~((now - entity.death) / 50) % 2;
			sprite = burst;
		} else if (!entity.airborne && Math.abs(entity.dx) > entity.walkmaxdx) {
			animFrame = 4;	// Skidding
		} else if (entity.airborne && (entity.lastImpulse && (now - entity.lastImpulse < 35))) {
			animFrame = 5; // Winds down
		} else if (entity.airborne) {
			entity.lastImpulse = null;
			animFrame = 6; // Wings up
		} else if (entity.facingLeft) {
			animFrame = 3 - animFrame;
		}

		var sw = sprite.sw[animFrame];
		var sh = sprite.sh[animFrame];
		var sx = sprite.sx[animFrame];
		var sy = sprite.sy[animFrame];
		var w = entity.w;
		var h = entity.h;
		
		if (entity.isPlayer) {
			var t = (player.y - h/2) / (skyHeight - h);
			var b = 0;
			var c = height - h - groundHeight;
			var d = 1;
			var y = Math.linearTween(t, b, c, d);
			scrollArena(y / c)
		} else {
			var y = entity.y - arena.scrollTop - h/2;
		}
		var x = entity.x - w/2;

		if (entity.facingLeft) {
			// Entity is moving to the left, so flip the sprite
			ctx.save();
			ctx.scale(-1,1);
			x = x * -1 - w; // Canvas is now flipped, so we need to adjust the position of our entity
		}

		ctx.drawImage(spritesheet, sx, sy, sw, sh, x, y, w, h);
		
		// Show wrap around smoothly
		if (!entity.facingLeft && x + w > width) {
			ctx.drawImage(spritesheet, sx, sy, sw, sh, x - width, y, w, h);
		} else if (entity.facingLeft && x - w < -width) {
			ctx.drawImage(spritesheet, sx, sy, sw, sh, x + width, y, w, h)
		}

		if (entity.facingLeft) {
			// Return to normal after adjusting for entity moving left
			ctx.restore();
		}
	}

	function scrollArena(p){
		arena.scrollTop = (arena.scrollHeight - height) * p;
	}

	//-------------------------------------------------------------------------
	// THE GAME LOOP
	//-------------------------------------------------------------------------
	
	function frame() {
		now = window.performance.now();
		dt = dt + Math.min(1, (now - last) / 1000);
		while(dt > step) {
			dt = dt - step;
			update(step);
		}
		render(dt);
		last = now;
		if (pause) return;
		requestAnimationFrame(frame, canvas);
	}

}();

