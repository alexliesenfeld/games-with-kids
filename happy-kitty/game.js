const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gamepadStatus = document.getElementById('gamepad-status');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');

canvas.width = 800;
canvas.height = 600;

let score = 0;

function resize() {
    const scale = Math.min(window.innerWidth / 800, window.innerHeight / 600);
    canvas.style.width = (800 * scale) + 'px';
    canvas.style.height = (600 * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const SPEED = 5;

// Sound effects using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'jump') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'collect') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'win') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.4);
        oscillator.frequency.exponentialRampToValueAtTime(1000, now + 0.6);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
    } else if (type === 'hit') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    } else if (type === 'gameover') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.8);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
        oscillator.start(now);
        oscillator.stop(now + 0.8);
    }
}

const keys = {};
let gamepad = null;

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

window.addEventListener('mousedown', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
});

window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
        e.gamepad.index, e.gamepad.id,
        e.gamepad.buttons.length, e.gamepad.axes.length);
    gamepadStatus.textContent = "Gamepad Connected: " + e.gamepad.id;
});

window.addEventListener("gamepaddisconnected", (e) => {
    console.log("Gamepad disconnected from index %d: %s",
        e.gamepad.index, e.gamepad.id);
    gamepadStatus.textContent = "Gamepad not detected";
});

class Player {
    constructor() {
        this.width = 60;
        this.height = 40;
        this.reset();
    }

    reset() {
        this.x = 100;
        this.y = canvas.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.color = '#ff9500'; // Garfield Orange
        this.facing = 1; // 1 for right, -1 for left
        this.walkCycle = 0;
        this.lives = 3;
        this.invincibilityFrames = 0;
        this.jumpCount = 0;
        this.jumpPressedLastFrame = false;
    }

    takeDamage() {
        if (this.invincibilityFrames > 0) return;
        this.lives--;
        this.invincibilityFrames = 60; // 1 second at 60fps
        livesDisplay.textContent = `Lives: ${this.lives}`;
        if (this.lives > 0) {
            playSound('hit');
        } else {
            playSound('gameover');
        }
    }

    update() {
        // Invincibility countdown
        if (this.invincibilityFrames > 0) {
            this.invincibilityFrames--;
        }

        if (this.onGround) {
            this.jumpCount = 0;
        }

        // Input Handling
        this.vx = 0;
        
        // Horizontal Movement (Keyboard)
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.vx = -SPEED;
            this.facing = -1;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            this.vx = SPEED;
            this.facing = 1;
        }

        // Jump Detection
        let jumpPressed = keys['ArrowUp'] || keys['KeyW'] || keys['Space'];

        // Gamepad
        const gamepads = navigator.getGamepads();
        if (gamepads[0]) {
            const gp = gamepads[0];
            
            // Analog stick
            const axisX = gp.axes[0];
            if (Math.abs(axisX) > 0.1) {
                this.vx = axisX * SPEED;
                if (this.vx > 0.1) this.facing = 1;
                if (this.vx < -0.1) this.facing = -1;
            }
            
            // D-pad
            if (gp.buttons[14] && gp.buttons[14].pressed) {
                this.vx = -SPEED;
                this.facing = -1;
            }
            if (gp.buttons[15] && gp.buttons[15].pressed) {
                this.vx = SPEED;
                this.facing = 1;
            }
            
            // Assuming Button 0 (A on Xbox) or Button 12 (D-pad Up) for jump
            if (gp.buttons[0].pressed || (gp.buttons[12] && gp.buttons[12].pressed)) {
                jumpPressed = true;
            }
        }

        // Jump Logic
        if (jumpPressed && !this.jumpPressedLastFrame) {
            if (this.onGround) {
                this.vy = JUMP_FORCE;
                this.onGround = false;
                this.jumpCount = 1;
                playSound('jump');
            } else if (this.jumpCount < 2) {
                // Double jump
                this.vy = JUMP_FORCE;
                this.jumpCount = 2;
                playSound('jump');
            }
        }
        this.jumpPressedLastFrame = jumpPressed;

        // Physics
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Keep in bounds (left)
        if (this.x < 0) this.x = 0;

        // Fall off screen reset
        if (this.y > canvas.height + 100) {
            resetGame();
        }

        // Update animation
        if (this.vx !== 0 && this.onGround) {
            this.walkCycle += 0.2;
        } else {
            this.walkCycle = 0;
        }
    }

    draw() {
        if (this.invincibilityFrames > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            return; // Skip drawing for blinking effect
        }
        ctx.save();
        ctx.translate(this.x - camera.x + (this.facing === -1 ? this.width : 0), this.y);
        ctx.scale(this.facing, 1);

        const legOffset = Math.sin(this.walkCycle) * 5;

        // Tail (Orange with black rings)
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(10, 20);
        ctx.quadraticCurveTo(-10, 0, 0, -15);
        ctx.stroke();
        
        // Tail rings
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-2, -5); ctx.lineTo(2, -8);
        ctx.moveTo(-4, -10); ctx.lineTo(0, -13);
        ctx.stroke();

        // Legs (back) - Garfield has thick legs
        ctx.fillStyle = this.color;
        ctx.fillRect(15, 25, 10, 15 + (this.onGround ? legOffset : 5));
        ctx.fillRect(35, 25, 10, 15 - (this.onGround ? legOffset : 5));

        // Body (Big and round)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(30, 22, 25, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Stripes on back
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(20, 8); ctx.lineTo(24, 15); ctx.lineTo(28, 8); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(30, 6); ctx.lineTo(34, 13); ctx.lineTo(38, 6); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(40, 8); ctx.lineTo(44, 15); ctx.lineTo(48, 8); ctx.fill();

        // Head (Round and slightly overlapping body)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(50, 15, 18, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head stripes
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(45, 2); ctx.lineTo(47, 8); ctx.lineTo(49, 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(51, 2); ctx.lineTo(53, 8); ctx.lineTo(55, 2); ctx.fill();

        // Ears (Small black triangles)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(40, 5);
        ctx.lineTo(38, -5);
        ctx.lineTo(45, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(55, 2);
        ctx.lineTo(62, -5);
        ctx.lineTo(60, 5);
        ctx.fill();

        // Eyes (Huge, white, touching in the middle)
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1.5;
        
        // Left eye
        ctx.beginPath();
        ctx.ellipse(45, 10, 7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Right eye
        ctx.beginPath();
        ctx.ellipse(55, 10, 7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Pupils (Lazy look)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(47, 12, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(53, 12, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyelids (Lazy look)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(45, 6, 8, 6, 0, Math.PI, Math.PI * 2); 
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(55, 6, 8, 6, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Nose (Pink oval)
        ctx.fillStyle = '#ffb7c5';
        ctx.beginPath();
        ctx.ellipse(50, 18, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Whiskers (Black)
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(54, 18); ctx.lineTo(65, 16);
        ctx.moveTo(54, 19); ctx.lineTo(65, 19);
        ctx.moveTo(54, 20); ctx.lineTo(65, 22);
        ctx.stroke();

        ctx.restore();
    }
}

class Dog {
    constructor(x, y, range) {
        this.startX = x;
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 30;
        this.range = range;
        this.vx = 2;
        this.facing = 1;
        this.walkCycle = 0;
        this.dead = false;
    }

    update() {
        if (this.dead) return;
        this.x += this.vx;
        if (this.x > this.startX + this.range) {
            this.vx = -2;
            this.facing = -1;
        } else if (this.x < this.startX) {
            this.vx = 2;
            this.facing = 1;
        }
        this.walkCycle += 0.2;
    }

    draw() {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x - camera.x + (this.facing === -1 ? this.width : 0), this.y);
        ctx.scale(this.facing, 1);

        // Dog color: Brownish
        ctx.fillStyle = '#8B4513'; 

        // Tail (Short and wagging-like)
        ctx.beginPath();
        ctx.moveTo(5, 20);
        ctx.quadraticCurveTo(-5, 10, 0, 5);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#8B4513';
        ctx.stroke();

        // Body (Sturdy)
        ctx.beginPath();
        ctx.ellipse(20, 22, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        const legOffset = Math.sin(this.walkCycle) * 3;
        ctx.fillRect(10, 28, 6, 8 + legOffset);
        ctx.fillRect(25, 28, 6, 8 - legOffset);

        // Head (Droopy ears)
        ctx.beginPath();
        ctx.ellipse(35, 15, 10, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears (Long and floppy)
        ctx.fillStyle = '#5D2E0A'; // Darker brown
        ctx.beginPath();
        ctx.ellipse(30, 15, 4, 10, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(40, 15, 4, 10, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#A0522D';
        ctx.beginPath();
        ctx.ellipse(42, 18, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(46, 18, 2, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(38, 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(39, 12, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

const player = new Player();
const camera = { x: 0 };

const platforms = [
    // Ground sections with gaps
    { x: 0, y: canvas.height - 40, width: 500, height: 40, type: 'ground' },
    { x: 700, y: canvas.height - 40, width: 600, height: 40, type: 'ground' },
    { x: 1500, y: canvas.height - 40, width: 1000, height: 40, type: 'ground' },

    // Floating platforms
    { x: 300, y: 450, width: 150, height: 20, type: 'platform' },
    { x: 550, y: 350, width: 150, height: 20, type: 'platform' },
    { x: 800, y: 250, width: 150, height: 20, type: 'platform' },
    { x: 1100, y: 300, width: 150, height: 20, type: 'platform' },
    { x: 1350, y: 420, width: 150, height: 20, type: 'platform' },

    // Steps/Blocks
    { x: 1800, y: 460, width: 100, height: 100, type: 'step' },
    { x: 1950, y: 360, width: 100, height: 200, type: 'step' },
    { x: 2100, y: 260, width: 100, height: 300, type: 'step' },
    
    // Final high platforms
    { x: 2300, y: 200, width: 200, height: 20, type: 'platform' },
];

const decorations = [
    { x: 50, y: canvas.height - 40, type: 'tree' },
    { x: 400, y: canvas.height - 40, type: 'bush' },
    { x: 750, y: canvas.height - 40, type: 'tree' },
    { x: 1000, y: canvas.height - 40, type: 'flower' },
    { x: 1550, y: canvas.height - 40, type: 'bush' },
    { x: 1700, y: canvas.height - 40, type: 'tree' },
    { x: 2200, y: canvas.height - 40, type: 'flower' },
];

const fishItems = [
    { x: 350, y: 400, collected: false },
    { x: 550, y: 300, collected: false },
    { x: 850, y: 200, collected: false },
    { x: 1150, y: 250, collected: false },
    { x: 1400, y: 370, collected: false },
    { x: 1850, y: 410, collected: false },
    { x: 2000, y: 310, collected: false },
    { x: 2150, y: 210, collected: false },
    { x: 2400, y: 150, collected: false },
    // Ground fish
    { x: 200, y: 530, collected: false },
    { x: 900, y: 530, collected: false },
    { x: 1600, y: 530, collected: false },
];

const dogs = [
    new Dog(800, canvas.height - 70, 400),
    new Dog(1600, canvas.height - 70, 500),
    new Dog(300, 420, 100),
    new Dog(1100, 270, 100),
];

function drawFish(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x - camera.x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFD700'; // Golden fish
    
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-18, -7);
    ctx.lineTo(-18, 7);
    ctx.closePath();
    ctx.fill();
    
    // Eye
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(6, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawFoodBowl(x, y) {
    // Fish inside the bowl (drawn first so they are "inside")
    drawFish(x - 10, y - 5, 0.6);
    drawFish(x + 10, y - 3, 0.6);
    drawFish(x, y - 8, 0.6);

    ctx.save();
    ctx.translate(x - camera.x, y);

    // Bowl body
    ctx.fillStyle = '#C0C0C0'; // Silver bowl
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-30, 25, 0, 25);
    ctx.quadraticCurveTo(30, 25, 30, 0);
    ctx.lineTo(-30, 0);
    ctx.fill();

    // Bowl rim
    ctx.strokeStyle = '#A9A9A9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#808080';
    ctx.fill();

    ctx.restore();
}

function drawDecoration(dec) {
    ctx.save();
    ctx.translate(dec.x - camera.x, dec.y);
    
    if (dec.type === 'tree') {
        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-10, -40, 20, 40);
        // Leaves
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(0, -50, 30, 0, Math.PI * 2);
        ctx.arc(-20, -35, 25, 0, Math.PI * 2);
        ctx.arc(20, -35, 25, 0, Math.PI * 2);
        ctx.fill();
    } else if (dec.type === 'bush') {
        ctx.fillStyle = '#43A047';
        ctx.beginPath();
        ctx.arc(-15, -10, 15, 0, Math.PI * 2);
        ctx.arc(15, -10, 15, 0, Math.PI * 2);
        ctx.arc(0, -20, 20, 0, Math.PI * 2);
        ctx.fill();
    } else if (dec.type === 'flower') {
        // Stem
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -15);
        ctx.stroke();
        // Petals
        ctx.fillStyle = '#2196F3'; // Blue flowers
        ctx.beginPath();
        ctx.arc(0, -15, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.arc(0, -15, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

const goal = {
    x: 2450,
    y: 190,
    width: 60,
    height: 35,
    collected: false
};

const clouds = [
    { x: 100, y: 100, speed: 0.2 },
    { x: 400, y: 150, speed: 0.3 },
    { x: 700, y: 80, speed: 0.25 },
    { x: 1000, y: 120, speed: 0.35 },
    { x: 1300, y: 90, speed: 0.2 },
];

function checkPlatformCollisions() {
    player.onGround = false;
    platforms.forEach(platform => {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height > platform.y &&
            player.y + player.height < platform.y + player.vy + 10 &&
            player.vy >= 0) {
            player.y = platform.y - player.height;
            player.vy = 0;
            player.onGround = true;
        }
    });
}

function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update
    player.update();
    checkPlatformCollisions();

    // Camera follow
    if (player.x > canvas.width / 2) {
        camera.x = player.x - canvas.width / 2;
    }

    // Draw Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + 100 < 0) cloud.x = 2000;
        
        ctx.beginPath();
        ctx.arc(cloud.x - (camera.x * 0.5), cloud.y, 30, 0, Math.PI * 2);
        ctx.arc(cloud.x + 25 - (camera.x * 0.5), cloud.y - 10, 30, 0, Math.PI * 2);
        ctx.arc(cloud.x + 50 - (camera.x * 0.5), cloud.y, 30, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Decorations
    decorations.forEach(dec => drawDecoration(dec));

    // Draw platforms
    platforms.forEach(platform => {
        if (platform.type === 'step') {
            ctx.fillStyle = '#7a7a7a'; // Stone gray
        } else {
            ctx.fillStyle = '#8B4513'; // Brown platforms
        }
        ctx.fillRect(platform.x - camera.x, platform.y, platform.width, platform.height);
        
        // Top layer
        if (platform.type === 'step') {
            ctx.fillStyle = '#9e9e9e'; // Lighter stone
        } else {
            ctx.fillStyle = '#228B22'; // Grass on top
        }
        ctx.fillRect(platform.x - camera.x, platform.y, platform.width, 5);
        
        // Texture for ground
        if (platform.type === 'ground') {
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            for (let i = 0; i < platform.width; i += 60) {
                ctx.fillRect(platform.x - camera.x + i + 20, platform.y + 15, 25, 10);
            }
        }
    });

    // Draw Fish
    fishItems.forEach(fish => {
        if (!fish.collected) {
            drawFish(fish.x, fish.y);
            
            // Check collection
            const dx = player.x + player.width/2 - fish.x;
            const dy = player.y + player.height/2 - fish.y;
            if (Math.sqrt(dx*dx + dy*dy) < player.width/2 + 10) {
                fish.collected = true;
                score++;
                scoreDisplay.textContent = `Fish: ${score}`;
                playSound('collect');
            }
        }
    });

    // Draw Dogs
    dogs.forEach(dog => {
        if (!goal.collected && player.lives > 0) {
            dog.update();
        }
        dog.draw();

        // Check collision
        if (player.lives > 0 && !goal.collected && !dog.dead) {
            const dx = (player.x + player.width/2) - (dog.x + dog.width/2);
            const dy = (player.y + player.height/2) - (dog.y + dog.height/2);
            if (Math.abs(dx) < (player.width/2 + dog.width/2) - 10 && 
                Math.abs(dy) < (player.height/2 + dog.height/2) - 5) {
                
                // Stomp detection: player is falling and is above the dog
                if (player.vy > 0 && player.y + player.height < dog.y + dog.height / 2 + player.vy) {
                    dog.dead = true;
                    player.vy = JUMP_FORCE / 1.5; // Bounce up a bit
                    player.jumpCount = 1; // Reset jump count to allow a double jump after stomping
                    playSound('collect'); // Using collect sound for now as a "pop"
                } else {
                    player.takeDamage();
                }
            }
        }
    });

    // Draw Goal (Food Bowl)
    if (!goal.collected && player.lives > 0) {
        drawFoodBowl(goal.x, goal.y);

        // Check collection
        const dx = player.x + player.width/2 - goal.x;
        const dy = player.y + player.height/2 - goal.y;
        if (Math.abs(dx) < player.width/2 + goal.width/2 && Math.abs(dy) < player.height/2 + goal.height/2) {
            goal.collected = true;
            playSound('win');
        }
    }

    player.draw();

    if (goal.collected) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('YOU WIN! Happy Kitty!', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText(`Final Score: ${score} Fish`, canvas.width / 2, canvas.height / 2 + 50);
        ctx.fillText('Press R or Button 1 to Restart', canvas.width / 2, canvas.height / 2 + 90);

        if (keys['KeyR']) {
            resetGame();
        }

        const gamepads = navigator.getGamepads();
        if (gamepads[0] && gamepads[0].buttons[1].pressed) {
            resetGame();
        }
    }

    if (player.lives <= 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('The Squirrels got Garfield!', canvas.width / 2, canvas.height / 2 + 50);
        ctx.fillText('Press R or Button 1 to Restart', canvas.width / 2, canvas.height / 2 + 90);

        if (keys['KeyR']) {
            resetGame();
        }

        const gamepads = navigator.getGamepads();
        if (gamepads[0] && gamepads[0].buttons[1].pressed) {
            resetGame();
        }
    }

    requestAnimationFrame(gameLoop);
}

function resetGame() {
    goal.collected = false;
    player.reset();
    livesDisplay.textContent = `Lives: ${player.lives}`;
    camera.x = 0;
    score = 0;
    scoreDisplay.textContent = `Fish: ${score}`;
    fishItems.forEach(f => f.collected = false);
    // Reset dogs
    dogs.forEach(d => {
        d.x = d.startX;
        d.dead = false;
    });
}

gameLoop();
