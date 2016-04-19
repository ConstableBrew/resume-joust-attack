'use strict';

!function(){
	
	const fps     = 60;
	const step    = 1/fps;
	const meter   = 24; // number of pixels per meter
	const gravity = 9.8 * meter;// acceleration due to gravity, m/s
	const jumpImpulse  = gravity/2 * fps;
	const flapImpulse  = gravity/3 * fps;
	const glideImpulse = gravity/3 * fps;
	const walkImpulse  = gravity/4 * fps;
	const walkmaxdx    = gravity;
	const maxdx   = gravity * 5;
	const maxdy   = gravity * 10;


	const ENTER    = 13;
	const ESC      = 27;
	const SPACE    = 32;
	const LEFT     = 37;
	const UP       = 38;
	const RIGHT    = 39;
	const DOWN     = 40;
	const LETTER_P = 80;
	const COMMA    = 188;
	const PERIOD   = 190;

	const yellowBird = {
		w: 19,
		h: 19,
		sy: [ 1, 1, 1, 1, 0,  0,  0],
		sx: [ 1,23,46,70,90,113,140],
		sw: [19,19,19,19,19, 19, 19],
		sh: [19,19,19,19,19, 19, 19]
	};
	const blueBird = {
		w: 19,
		h: 19,
		sy: [28,28,28,28,27, 28, 28],
		sx: [ 1,23,46,70,90,113,140],
		sw: [19,19,19,19,19, 19, 19],
		sh: [19,19,19,19,19, 19, 19]
	};
	const greenBird = {
		w: 19,
		h: 19,
		sy: [50,50,50,49,48, 50, 50],
		sx: [ 0,23,46,69,90,113,140],
		sw: [19,19,19,19,19, 19, 19],
		sh: [19,19,19,19,19, 19, 19]
	};
	const creatures = [yellowBird, blueBird, greenBird];


	var link = document.getElementById('resume-content');
	var arena = document.getElementById('arena');
	var arenaSky = document.querySelector('#arena .sky');
	var arenaGround = document.querySelector('#arena .ground');
	var drops = document.createElement('div'); // Chunks of resume to insert when the player does good things
	var canvas   = document.getElementById('canvas');
	var ctx      = canvas.getContext('2d');
	var sprite   = new Image();
	var width    = canvas.width  = window.innerWidth;
	var height   = canvas.height = window.innerHeight;
	var skyHeight= arena.scrollHeight;
	var landWidth= arena.clientWidth;
	var player   = {};
	var pause    = false;


	var dt = 0;
	var now;
	var last = window.performance.now();

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

	function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
		return !(
			((x1 + w1 - 1) < x2) ||
			((x2 + w2 - 1) < x1) ||
			((y1 + h1 - 1) < y2) ||
			((y2 + h2 - 1) < y1)
		);
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
		return new Promise((resolve, reject) => {
			sprite.src = 'spritesheet.png'; // Should wait for this too... TODO
			if (link.import) {
				// content already loaded
				setTimeout(resolve,0);
			} else {
				// not loaded yet, listen for load event
				link.addEventListener('load', resolve);
			}	
		});
	}

	function loadContent(){
		// We pull out all of the tags (ignoring raw text nodes) from the resume
		// and stick those into our drops. The drops then are placed into the
		// arena at a time as needed

		var resume = link.import.querySelector('body');
		
		while (resume.firstChild){
			var node = resume.removeChild(resume.firstChild);
			if (node.nodeType == Node.ELEMENT_NODE)
				drops.appendChild(node);
		}
	}

	function initGame(){
		player = setupEntity({type: 'player', sprite: creatures[~~(Math.random() * creatures.length)]});
		document.addEventListener('keydown',   function(event) { return handleInput(event, event.keyCode, true)}, false);
		document.addEventListener('keyup',     function(event) { return handleInput(event, event.keyCode,false)}, false);
		document.addEventListener('mousedown', function(event) { return handleInput(event, event.button,  true)}, false);
		document.addEventListener('mouseup',   function(event) { return handleInput(event, event.button, false)}, false);
		document.addEventListener('touchstart',function(event) { return handleInput(event, event.button,  true)}, false);
		document.addEventListener('touchend',  function(event) { return handleInput(event, event.button, false)}, false);
	}


	function setupEntity(obj) {
		var entity = {};
		obj             = obj || {};
		obj.options 	= obj.options || {};

		entity.x          = +obj.x || 0;
		entity.y          = +obj.y || 0;
		entity.dx         = +obj.dx || 0;
		entity.dy         = +obj.dy || 0;
		entity.isMonster  = obj.type === 'monster';
		entity.isPlayer   = obj.type === 'player';
		entity.isTreasure = obj.type === 'treasure';
		entity.sprite     = obj.sprite;
		entity.start      = { x: +obj.x || 0, y: +obj.y || 0 };
		entity.gravity    = obj.options.gravity !== undefined ? obj.options.gravity : gravity;
		entity.maxdx      = obj.options.maxdx   !== undefined ? obj.options.maxdx   : maxdx;
		entity.maxdy      = obj.options.maxdy   !== undefined ? obj.options.maxdy   : maxdy;
		entity.jumpImpulse  = obj.options.jumpImpulse  !== undefined ? obj.options.jumpImpulse  : jumpImpulse;
		entity.flapImpulse  = obj.options.flapImpulse  !== undefined ? obj.options.flapImpulse  : flapImpulse;
		entity.glideImpulse = obj.options.glideImpulse !== undefined ? obj.options.glideImpulse : glideImpulse;
		entity.walkImpulse  = obj.options.walkImpulse  !== undefined ? obj.options.walkImpulse  : walkImpulse;
		entity.walkmaxdx    = obj.options.walkmaxdx    !== undefined ? obj.options.walkmaxdx    : walkmaxdx  ;
		return entity;
	}





	//-------------------------------------------------------------------------
	// UPDATE LOOP
	//-------------------------------------------------------------------------


	function handleInput(event, key, isDown) {

		
		switch (key){
			case UP:
			case ENTER:
				if (!isDown) {
					player.lastImpulse = null;
					return;
				}
				player.jumpflap = true;
				event.preventDefault();
				return false;
			case RIGHT:
				if (!isDown) {
					player.lastImpulse = null;
					return;
				}
				player.goRight = true;
				event.preventDefault();
				return false;
			case LEFT:
				if (!isDown) {
					player.lastImpulse = null;
					return;
				}
				player.goLeft = true;
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
			case ESC:
			case LETTER_P:
				if (!isDown) return;
				pause = !pause;
				last = window.performance.now();
				if (!pause) frame(); // Game was unpaused
				event.preventDefault();
				return false;
			default:
				console.log('Key:', key, 'isDown:', isDown);
		}
	}

	function addChunk(){
		if (drops.firstChild) {
			arena.insertBefore(drops.firstChild, arenaGround);
			skyHeight = arena.scrollHeight;
		}
	}

	function update(dt) {
		updatePlayer(dt);
	}

	function updatePlayer(dt) {
		updateEntity(player, dt);
	}

	function updateEntity(entity, dt) {
		entity.ddx = 0;
		entity.ddy = entity.gravity;

		if (entity.jumpflap) {
			entity.ddy -= entity.airborne ? entity.flapImpulse : entity.jumpImpulse;
			entity.jumpflap = false;
			entity.lastImpulse = window.performance.now();
		}

		if (entity.goRight) {
			entity.goRight = false;
			entity.lastImpulse = window.performance.now();
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
			entity.lastImpulse = window.performance.now();
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

		entity.dx = clamp(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
		entity.dy = clamp(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);
		entity.x  = wrap (entity.x  + (dt * entity.dx), 0, landWidth);
		entity.y  = clamp(entity.y  + (dt * entity.dy), 0, skyHeight);

		// Adjust the facing of the entity.
		// If the entity comes to a rest (dx == 0), the current facing will be retained
		if (entity.dx < 0){
			entity.facingLeft = true;
		} else if (entity.dx > 0) {
			entity.facingLeft = false;
		}

		// Collision Detection

		if (entity.airborne && entity.y >= skyHeight) {
			// Just landed
			entity.airborne = false;
			entity.walkingVelocity = entity.dx;
			entity.lastWalked = window.performance.now();
		} else if (!entity.airborne && entity.y < skyHeight) {
			// Just took flight
			entity.airborne = true;
		}

		if (entity.y >= skyHeight) entity.dy = 0; // On the ground. Stop all downward motion.
		if (entity.y <= 0) entity.dy = ~~(entity.dy / 1.2); // Hit the top of the sky. Quickly slow down motion.
		
		if (!entity.airborne && entity.dx !== 0) {
			var t = window.performance.now() - entity.lastWalked;
			var b = entity.walkingVelocity;
			var c = entity.walkingVelocity * -1;
			var d = 1000;
			entity.dx = Math.easeInQuadTween(t, b, c, d);
			if (t >= d) entity.dx = 0;
		}
	
	}



	//-------------------------------------------------------------------------
	// RENDERING
	//-------------------------------------------------------------------------

	function render(dt) {
		scrollArena(player.y);
		ctx.clearRect(0, 0, width, height);
		renderPlayer(dt);
	}

	function scrollArena(y){
		y = Math.abs(~~y);
		arena.scrollTop = y - arena.clientHeight;
	}

	function renderPlayer(dt){
		renderCreature(player, dt);
	}

	function renderCreature(entity, dt) {
		var scale = 3;
		var animFrame = ~~(entity.x / (entity.sprite.w / 4)) % 4;
		if (entity.facingLeft) {
			animFrame = 3 - animFrame;
		}
		console.log()
		if (!entity.airborne && Math.abs(entity.dx) > entity.walkmaxdx) {
			animFrame = 4;	// Skidding
		} else if (entity.airborne && (entity.lastImpulse && (window.performance.now() - entity.lastImpulse < 35))) {
			animFrame = 5; // Winds down
		} else if (entity.airborne) {
			entity.lastImpulse = null;
			animFrame = 6; // Wings up
		}
		var sw = entity.sprite.sw[animFrame];
		var sh = entity.sprite.sh[animFrame];
		var sx = entity.sprite.sx[animFrame];
		var sy = entity.sprite.sy[animFrame];
		var w = sw * scale;
		var h = sh * scale;
		
		var t = entity.y / skyHeight;
		var b = 0;
		var c = height - scale * sh * 1.5;
		var d = 1;
		var x = entity.x;
		var y = Math.linearTween(t, b, c, d);

		ctx.fillStyle = 'gold';
		ctx.font = '0.75em sans-serif';
		ctx.fillText('x:' + ~~entity.x + ', dx:' + ~~entity.dx, 50, 20);

		if (entity.facingLeft) {
			// Entity is moving to the left, so flip the sprite
			ctx.save();
			ctx.scale(-1,1);
			x = x * -1 - w; // Canvas is now flipped, so we need to adjust the position of our entity
		}

		ctx.drawImage(sprite, sx, sy, sw, sh, x, y, w, h);
		
		// Show wrap around smoothly
		if (!entity.facingLeft && x + w > width) {
			ctx.drawImage(sprite, sx, sy, sw, sh, x - width, y, w, h);
		} else if (entity.facingLeft && x - w < -width) {
			ctx.drawImage(sprite, sx, sy, sw, sh, x + width, y, w, h)
		}

		if (entity.facingLeft) {
			// Return to normal after adjusting for entity moving left
			ctx.restore();
		}
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

