const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const speedText = document.getElementById('speed-text');
const distanceText = document.getElementById('distance-text');
const levelCompleteUI = document.getElementById('level-complete');

// --- Audio Manager ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.nextChugTime = 0;
        this.chugCount = 0;
        this.rumbleSource = null;
        this.rumbleGain = null;
        this.noiseBuffer = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.createNoiseBuffer();
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    createNoiseBuffer() {
        if (this.noiseBuffer) return this.noiseBuffer;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
        return buffer;
    }

    initRumble() {
        if (!this.ctx || this.rumbleSource) return;

        this.rumbleSource = this.ctx.createBufferSource();
        this.rumbleSource.buffer = this.noiseBuffer;
        this.rumbleSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 80;

        this.rumbleGain = this.ctx.createGain();
        this.rumbleGain.gain.value = 0;

        this.rumbleSource.connect(filter);
        filter.connect(this.rumbleGain);
        this.rumbleGain.connect(this.ctx.destination);

        this.rumbleSource.start();
    }

    updateRumble(speed) {
        if (this.rumbleGain) {
            const targetGain = Math.min(0.04, speed * 0.003);
            this.rumbleGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
        }
    }

    playChug(speed, interval) {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const duration = Math.min(0.15, (interval / 1000) * 0.8);

        // 1. The "Hiss" (Steam release) - Bandpassed noise
        const hiss = this.ctx.createBufferSource();
        hiss.buffer = this.noiseBuffer;
        
        const hissFilter = this.ctx.createBiquadFilter();
        hissFilter.type = 'bandpass';
        hissFilter.frequency.setValueAtTime(800 + speed * 40, now);
        hissFilter.Q.value = 1.5;

        const hissGain = this.ctx.createGain();
        hissGain.gain.setValueAtTime(0, now);
        hissGain.gain.linearRampToValueAtTime(0.06, now + 0.01);
        hissGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        hiss.connect(hissFilter);
        hissFilter.connect(hissGain);
        hissGain.connect(this.ctx.destination);
        hiss.start(now);
        hiss.stop(now + duration);

        // 2. The "Thump" (Mechanical piston) - Low frequency triangle
        const thump = this.ctx.createOscillator();
        thump.type = 'triangle';
        thump.frequency.setValueAtTime(50 + speed * 2, now);
        thump.frequency.exponentialRampToValueAtTime(30, now + duration * 0.6);

        const thumpGain = this.ctx.createGain();
        thumpGain.gain.setValueAtTime(0, now);
        thumpGain.gain.linearRampToValueAtTime(0.12, now + 0.005);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6);

        thump.connect(thumpGain);
        thumpGain.connect(this.ctx.destination);
        thump.start(now);
        thump.stop(now + duration * 0.6);
    }

    playThrow() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.15);
    }

    playHit() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Metallic resonance
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.08, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);

        // Crunch sound
        const crunch = this.ctx.createBufferSource();
        crunch.buffer = this.noiseBuffer;
        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'highpass';
        crunchFilter.frequency.value = 1500;
        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(0.04, now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        crunch.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
        crunch.start(now);
        crunch.stop(now + 0.08);
    }

    playWhistle() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const duration = 0.7;

        const frequencies = [587.33, 739.99, 880.00]; // D5, F#5, A5
        
        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 6 + i;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = freq * 1.8;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.03, now + 0.1);
            gain.gain.linearRampToValueAtTime(0.02, now + duration - 0.1);
            gain.gain.linearRampToValueAtTime(0, now + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
            lfo.stop(now + duration);
        });

        // Air noise for whistle
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 2500;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0, now);
        nGain.gain.linearRampToValueAtTime(0.015, now + 0.1);
        nGain.gain.linearRampToValueAtTime(0, now + duration);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + duration);
    }

    playJump() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        
        // A "boing" like steam release
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playHonk() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const duration = 1.2;

        const frequencies = [311.13, 370.00]; // Eb4, Gb4
        
        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 5;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
            gain.gain.linearRampToValueAtTime(0.08, now + duration - 0.2);
            gain.gain.linearRampToValueAtTime(0, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
            lfo.stop(now + duration);
        });
    }

    updateChug(speed, distance) {
        if (!this.ctx) return;
        this.initRumble();
        this.updateRumble(speed);
        
        // Chug interval depends on speed, cap it to avoid machine gun effect
        let interval = 500 / (speed * 0.5);
        if (interval < 60) interval = 60; // Minimum 60ms between chugs
        
        if (Date.now() > this.nextChugTime) {
            this.playChug(speed, interval);
            this.nextChugTime = Date.now() + interval;
        }
    }
}

const audio = new AudioManager();

// Set canvas size to full window
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let speed = 2;
let targetSpeed = 2;
let distance = 0;
let levelCompleted = false;
const MAX_DISTANCE = 100000; // 10 km (10,000 units = 1 km)
const NUM_WAGONS = 8;
const WAGON_WIDTH = 120;
const WAGON_GAP = 20;
const UNIT_SPACING = WAGON_WIDTH + WAGON_GAP;

function getTrainX() {
    return canvas.width / 2 - 50;
}

let jumpY = 0;
let jumpVY = 0;
const trainGravity = 0.5;
let coalPieces = [];
let particles = [];
let clouds = [];
let mountains = [];
let trees = [];
let balloons = [];
let airplanes = [];
let tunnels = [];
let isKeyPressed = false;
let isGamepadBoostActive = false;
let prevGamepadButtons = [];

function getTerrainHeight(dist) {
    // Kombiniert zwei Sinuswellen für abwechslungsreiche Hügel
    return Math.sin(dist * 0.002) * 50 + Math.sin(dist * 0.005) * 20;
}

// Initialize environment
function initEnvironment() {
    clouds = [];
    for (let i = 0; i < 8; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height * 0.4) + 20,
            speed: Math.random() * 0.5 + 0.1,
            size: Math.random() * 30 + 20
        });
    }

    mountains = [];
    for (let i = 0; i < 5; i++) {
        mountains.push({
            x: i * (canvas.width / 3) + Math.random() * 100,
            height: Math.random() * 150 + 100,
            width: Math.random() * 300 + 200,
            color: `rgb(${Math.floor(Math.random() * 20 + 100)}, ${Math.floor(Math.random() * 20 + 110)}, ${Math.floor(Math.random() * 20 + 120)})`
        });
    }

    trees = [];
    for (let i = 0; i < 15; i++) {
        trees.push({
            x: i * (canvas.width / 10) + Math.random() * 50,
            y: canvas.height - 120,
            size: Math.random() * 20 + 30,
            hasCat: Math.random() < 0.3,
            catColor: ['#FFA500', '#333333', '#FFFFFF', '#888888'][Math.floor(Math.random() * 4)]
        });
    }

    balloons = [];
    for (let i = 0; i < 3; i++) {
        balloons.push({
            x: Math.random() * canvas.width,
            y: 100 + Math.random() * 150,
            size: 30 + Math.random() * 20,
            speed: 0.1 + Math.random() * 0.1,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`
        });
    }

    airplanes = [];
    for (let i = 0; i < 2; i++) {
        airplanes.push({
            x: Math.random() * canvas.width,
            y: 40 + Math.random() * 60,
            speed: 0.6 + Math.random() * 0.4
        });
    }

    tunnels = [
        { worldX: 20000, length: 4000, hasHonked: false },
        { worldX: 55000, length: 5000, hasHonked: false },
        { worldX: 85000, length: 4000, hasHonked: false }
    ];
}
initEnvironment();

class Coal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2 + 5; // Throw towards locomotive
        this.vy = -Math.random() * 10 - 5;
        this.gravity = 0.5;
        this.size = 10;
        this.reachedLocomotive = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;

        const trainX = getTrainX();
        const locoMidX = trainX + 210;
        const locoWorldX = distance + locoMidX;
        const locoTerrainY = getTerrainHeight(locoWorldX);
        const locoY = (canvas.height - 80) - locoTerrainY - jumpY;

        // Check if it hits the locomotive area (now facing right and moving with hills)
        if (!this.reachedLocomotive && this.x > locoMidX - 70 && this.x < locoMidX + 70 && this.y > locoY - 100 && this.y < locoY + 20) {
            this.reachedLocomotive = true;
            targetSpeed += 0.5;
            audio.playHit();
            createSmoke(this.x, this.y);
            return false; // Remove coal
        }

        return this.y < canvas.height; 
    }

    draw() {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createSmoke(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3 - 1,
            life: 1.0,
            size: Math.random() * 15 + 5
        });
    }
}

function drawGuy(ctx, x, y, speed) {
    ctx.save();
    // Guy's head
    ctx.fillStyle = '#FFCCBC'; // Skin tone
    ctx.beginPath();
    ctx.arc(x + 25, y - 17, 8, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(x + 22, y - 19, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 28, y - 19, 1.5, 0, Math.PI * 2); ctx.fill();

    // Hands (waving when fast)
    if (speed > 4) {
        ctx.strokeStyle = '#FFCCBC';
        ctx.lineWidth = 3;
        const wave = Math.sin(Date.now() / 50) * 8;
        ctx.beginPath();
        ctx.moveTo(x + 18, y - 12);
        ctx.lineTo(x + 12, y - 20 + wave);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 32, y - 12);
        ctx.lineTo(x + 38, y - 20 - wave);
        ctx.stroke();
    }

    // Mouth
    ctx.beginPath();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    const mouthOpen = Math.min(5, speed / 4);
    if (speed > 5) {
        ctx.fillStyle = 'black';
        ctx.ellipse(x + 25, y - 12, 3, mouthOpen, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.arc(x + 25, y - 12, mouthOpen, 0, Math.PI, false);
        ctx.stroke();
    }

    // Scream text
    if (speed > 4) {
        ctx.fillStyle = '#FFEB3B'; 
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.floor(16 + speed * 2)}px 'Arial Black', Arial, sans-serif`;
        const text = "THE FASTER WE GO!!!";
        const textX = x + 25;
        const textY = y - 60 - (Math.abs(Math.sin(Date.now() / 100)) * 10);
        
        ctx.strokeText(text, textX, textY);
        ctx.fillText(text, textX, textY);
    }
    ctx.restore();
}

function drawCat(ctx, x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.arc(6, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.beginPath();
    ctx.moveTo(3, -7); ctx.lineTo(5, -12); ctx.lineTo(8, -8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -7); ctx.lineTo(10, -12); ctx.lineTo(12, -8);
    ctx.fill();
    
    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(-12, -10, -8, -15);
    ctx.stroke();
    
    ctx.restore();
}

function drawBalloon(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    
    // Ropes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, size);
    ctx.lineTo(-5, size + 20);
    ctx.moveTo(10, size);
    ctx.lineTo(5, size + 20);
    ctx.stroke();
    
    // Basket
    ctx.fillStyle = '#795548';
    ctx.fillRect(-8, size + 20, 16, 12);
    
    // Balloon
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.4, size, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawAirplane(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    
    // Body
    ctx.fillStyle = '#ECEFF1';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings
    ctx.fillStyle = '#CFD8DC';
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(10, -20);
    ctx.lineTo(20, -20);
    ctx.lineTo(5, 0);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(10, 15);
    ctx.lineTo(20, 15);
    ctx.lineTo(5, 0);
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-35, -12);
    ctx.lineTo(-28, -12);
    ctx.lineTo(-20, 0);
    ctx.fill();
    
    ctx.restore();
}

function drawTunnelBack(ctx) {
    tunnels.forEach(t => {
        let tunnelStartX = t.worldX - distance;
        let tunnelEndX = tunnelStartX + t.length;
        
        if (tunnelEndX > 0 && tunnelStartX < canvas.width) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            // Bottom edge (following terrain)
            for (let x = Math.max(0, tunnelStartX); x <= Math.min(canvas.width, tunnelEndX); x += 20) {
                const worldX = distance + x;
                const terrainY = getTerrainHeight(worldX);
                const ty = (canvas.height - 70) - terrainY;
                if (x === Math.max(0, tunnelStartX)) ctx.moveTo(x, ty);
                else ctx.lineTo(x, ty);
            }
            // Top edge (following terrain + height)
            for (let x = Math.min(canvas.width, tunnelEndX); x >= Math.max(0, tunnelStartX); x -= 20) {
                const worldX = distance + x;
                const terrainY = getTerrainHeight(worldX);
                const ty = (canvas.height - 70) - terrainY - 200;
                ctx.lineTo(x, ty);
            }
            ctx.closePath();
            ctx.fill();
        }
    });
}


function drawWagon(ctx, midX, y, angle, color, hasCoal) {
    ctx.save();
    ctx.translate(midX, y);
    ctx.rotate(angle);
    
    // Wagon body
    ctx.fillStyle = color;
    ctx.fillRect(-60, -60, 120, 60);
    // Wheels
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-30, 0, 15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 0, 15, 0, Math.PI * 2); ctx.fill();
    
    // Coal in wagon
    if (hasCoal) {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-20, -60, 15, 0, Math.PI * 2); ctx.fill();
        ctx.arc(0, -65, 18, 0, Math.PI * 2); ctx.fill();
        ctx.arc(25, -60, 15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawTrain() {
    const x = getTrainX();
    const baseGroundY = canvas.height - 70;
    const trackY = baseGroundY - 10;

    const wagonPositions = [];

    // Calculate all wagon positions first
    for (let i = 0; i < NUM_WAGONS; i++) {
        const midX = x + 60 - i * UNIT_SPACING;
        const worldX = distance + midX;
        const terrainY = getTerrainHeight(worldX);
        const y = trackY - terrainY - jumpY;
        const angle = Math.atan2(-(getTerrainHeight(worldX + 1) - terrainY), 1);
        wagonPositions.push({ midX, y, angle });
    }

    // --- Locomotive ---
    const locoMidX = x + 210;
    const locoWorldX = distance + locoMidX;
    const locoTerrainY = getTerrainHeight(locoWorldX);
    const locoY = trackY - locoTerrainY - jumpY;
    const locoAngle = Math.atan2(-(getTerrainHeight(locoWorldX + 1) - locoTerrainY), 1);

    // Draw connections
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 10;
    ctx.beginPath();
    // Connection between first wagon and locomotive
    ctx.moveTo(wagonPositions[0].midX + 60, wagonPositions[0].y - 20);
    ctx.lineTo(locoMidX - 70, locoY - 20);
    // Connections between wagons
    for (let i = 0; i < NUM_WAGONS - 1; i++) {
        ctx.moveTo(wagonPositions[i+1].midX + 60, wagonPositions[i+1].y - 20);
        ctx.lineTo(wagonPositions[i].midX - 60, wagonPositions[i].y - 20);
    }
    ctx.stroke();

    // Draw wagons
    const colors = ['#5D4037', '#D32F2F', '#1976D2', '#388E3C', '#FBC02D', '#7B1FA2', '#E64A19', '#455A64'];
    for (let i = 0; i < NUM_WAGONS; i++) {
        const color = colors[i % colors.length];
        drawWagon(ctx, wagonPositions[i].midX, wagonPositions[i].y, wagonPositions[i].angle, color, true);
    }

    ctx.save();
    ctx.translate(locoMidX, locoY);
    ctx.rotate(locoAngle);

    // Locomotive body
    ctx.fillStyle = '#D32F2F'; // Red
    ctx.fillRect(-70, -80, 140, 80); // Main body
    
    // Cabin
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(-70, -120, 50, 50); 
    
    // Funnel
    ctx.fillStyle = '#333';
    ctx.fillRect(20, -110, 30, 40); 
    
    // Windows
    ctx.fillStyle = '#81D4FA';
    ctx.fillRect(-60, -110, 30, 25);

    drawGuy(ctx, -70, -80, speed);

    // Wheels
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-40, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(40, 0, 20, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
    
    // Smoke from funnel (calculated with absolute position)
    if (Math.random() < speed / 20) {
        const smokeRelX = 35;
        const smokeRelY = -110;
        const cos = Math.cos(locoAngle);
        const sin = Math.sin(locoAngle);
        const absX = locoMidX + smokeRelX * cos - smokeRelY * sin;
        const absY = locoY + smokeRelX * sin + smokeRelY * cos;
        createSmoke(absX, absY);
    }
}

function drawBackground() {
    const baseGroundY = canvas.height - 70;
    const trackOffset = -10;
    const trackY = baseGroundY + trackOffset;

    // Ground with Hills
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x <= canvas.width; x += 10) {
        const worldX = distance + x;
        const terrainY = getTerrainHeight(worldX);
        ctx.lineTo(x, baseGroundY - terrainY);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
    
    // Tracks with Hills
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
        const worldX = distance + x;
        const terrainY = getTerrainHeight(worldX);
        ctx.lineTo(x, trackY - terrainY);
    }
    ctx.stroke();
    
    // Mountains
    mountains.forEach(mtn => {
        let mtnX = (mtn.x - distance * 0.3) % (canvas.width + mtn.width);
        if (mtnX < -mtn.width) mtnX += (canvas.width + mtn.width);

        // Berge bleiben auf dem Basis-Niveau
        ctx.fillStyle = mtn.color;
        ctx.beginPath();
        ctx.moveTo(mtnX, baseGroundY);
        ctx.lineTo(mtnX + mtn.width / 2, baseGroundY - mtn.height);
        ctx.lineTo(mtnX + mtn.width, baseGroundY);
        ctx.fill();

        // Snow cap
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(mtnX + mtn.width * 0.4, baseGroundY - mtn.height * 0.8);
        ctx.lineTo(mtnX + mtn.width / 2, baseGroundY - mtn.height);
        ctx.lineTo(mtnX + mtn.width * 0.6, baseGroundY - mtn.height * 0.8);
        ctx.fill();
    });

    // Sleeper synchronization with Hills
    const sleeperSpacing = 60;
    const sleeperOffset = distance % sleeperSpacing;
    for (let x = -sleeperSpacing; x < canvas.width + sleeperSpacing; x += sleeperSpacing) {
        const drawX = x - sleeperOffset;
        const worldX = distance + drawX;
        const terrainY = getTerrainHeight(worldX);
        const sy = trackY - terrainY;

        ctx.save();
        ctx.translate(drawX, sy);
        // Angle of the hill
        const angle = Math.atan2(-(getTerrainHeight(worldX + 1) - terrainY), 1);
        ctx.rotate(angle);
        ctx.fillStyle = '#A1887F';
        ctx.fillRect(-7, 0, 15, 20);
        ctx.restore();
    }

    // Clouds
    ctx.fillStyle = 'white';
    clouds.forEach(cloud => {
        let cloudX = (cloud.x - distance * cloud.speed) % (canvas.width + 200);
        if (cloudX < -100) cloudX += (canvas.width + 200);
        
        ctx.beginPath();
        ctx.arc(cloudX, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloudX + cloud.size * 0.6, cloud.y - cloud.size * 0.3, cloud.size * 0.8, 0, Math.PI * 2);
        ctx.arc(cloudX + cloud.size * 1.2, cloud.y, cloud.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });

    // Hot Air Balloons
    balloons.forEach(balloon => {
        let bx = (balloon.x - distance * balloon.speed) % (canvas.width + 400);
        if (bx < -200) bx += (canvas.width + 400);
        // Add a slight bobbing effect
        let by = balloon.y + Math.sin(Date.now() / 1000 + balloon.x) * 10;
        drawBalloon(ctx, bx, by, balloon.size, balloon.color);
    });

    // Airplanes
    airplanes.forEach(plane => {
        let px = (plane.x - distance * plane.speed) % (canvas.width + 400);
        if (px < -200) px += (canvas.width + 400);
        drawAirplane(ctx, px, plane.y);
    });

    // Trees on Hills
    trees.forEach(tree => {
        let treeX = (tree.x - distance) % (canvas.width + 200);
        if (treeX < -100) treeX += (canvas.width + 200);
        
        const worldX = distance + treeX + 20;
        const terrainY = getTerrainHeight(worldX);
        const ty = baseGroundY - terrainY;

        ctx.fillStyle = '#3E2723';
        ctx.fillRect(treeX + 15, ty - 50, 10, 50);
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.moveTo(treeX - 10, ty - 40);
        ctx.lineTo(treeX + 20, ty - 90);
        ctx.lineTo(treeX + 50, ty - 40);
        ctx.fill();

        if (tree.hasCat) {
            drawCat(ctx, treeX + 20, ty - 70, tree.catColor);
        }
    });

    drawTunnelBack(ctx);
}

function handleGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let currentBoostActive = false;

    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        if (!prevGamepadButtons[i]) prevGamepadButtons[i] = [];

        for (let b = 0; b < gp.buttons.length; b++) {
            const button = gp.buttons[b];
            const wasPressed = prevGamepadButtons[i][b];
            
            if (button.pressed) {
                if (!wasPressed) {
                    // New button press
                    audio.init();
                    audio.resume();
                    targetSpeed += 0.5;
                    
                    if (!isKeyPressed && !isGamepadBoostActive && !currentBoostActive) {
                        audio.playWhistle();
                    }
                    
                    // Button 0 (A) throws coal
                    if (b === 0) {
                        throwCoalFromWagon();
                    }
                    // Button 1 (B/Circle) or Button 2 (X/Square) jumps
                    if (b === 1 || b === 2) {
                        startJump();
                    }
                }
                currentBoostActive = true;
            }
            prevGamepadButtons[i][b] = button.pressed;
        }
    }
    isGamepadBoostActive = currentBoostActive;
}

function startJump() {
    if (jumpY === 0) {
        jumpVY = 12;
        audio.playJump();
    }
}

function update() {
    if (!levelCompleted) {
        handleGamepad();
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Jump physics
    if (jumpY > 0 || jumpVY !== 0) {
        jumpY += jumpVY;
        jumpVY -= trainGravity;
        if (jumpY <= 0) {
            jumpY = 0;
            jumpVY = 0;
        }
    }
    
    // Continuous boost when holding a key or button
    if (!levelCompleted && (isKeyPressed || isGamepadBoostActive)) {
        targetSpeed += 0.05; // Reduced acceleration (was 0.15)
        if (targetSpeed > 25) targetSpeed = 25; // Reasonable speed cap
    }

    // Gradually slow down
    const deceleration = (isKeyPressed || isGamepadBoostActive) ? 0.005 : 0.1;
    if (targetSpeed > 2 && !levelCompleted) {
        targetSpeed -= deceleration;
        if (targetSpeed < 2) targetSpeed = 2;
    }
    
    // If level completed, force stop
    if (levelCompleted) {
        targetSpeed = 0;
        speed *= 0.98;
        if (speed < 0.1) speed = 0;
    }

    // Faster acceleration when a key is pressed
    const lerpFactor = (isKeyPressed || isGamepadBoostActive) ? 0.15 : 0.1; // Reduced (was 0.3 : 0.15)
    speed += (targetSpeed - speed) * lerpFactor;
    
    // Accumulate distance
    distance += speed;

    // Check for level completion
    if (!levelCompleted && distance >= MAX_DISTANCE) {
        levelCompleted = true;
        levelCompleteUI.style.display = 'block';
    }
    
    audio.updateChug(speed, distance);
    
    speedText.innerText = `Speed: ${Math.round(speed * 10)}`;
    distanceText.innerText = `Distance: ${(distance / 10000).toFixed(1)} km`;

    drawBackground();
    drawTrain();

    // Tunnel honk logic
    const locoMidX_h = getTrainX() + 210;
    const locoWorldX_h = distance + locoMidX_h;
    tunnels.forEach(t => {
        if (!t.hasHonked && locoWorldX_h > t.worldX && locoWorldX_h < t.worldX + t.length) {
            audio.playHonk();
            t.hasHonked = true;
        }
    });

    // Update Coal
    coalPieces = coalPieces.filter(coal => {
        const active = coal.update();
        if (active) coal.draw();
        return active;
    });

    // Update Particles
    particles = particles.filter(p => {
        p.x -= speed * 0.5;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        ctx.fillStyle = `rgba(150, 150, 150, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1-p.life)), 0, Math.PI * 2);
        ctx.fill();
        return p.life > 0;
    });

    requestAnimationFrame(update);
}

function throwCoalFromWagon(wagonIndex = 0) {
    const x = getTrainX();
    const wagonMidX = x + 60 - wagonIndex * UNIT_SPACING;
    const worldX = distance + wagonMidX;
    const wagonY = (canvas.height - 80) - getTerrainHeight(worldX) - jumpY;

    coalPieces.push(new Coal(wagonMidX, wagonY - 30));
    audio.playThrow();
}

// Interaction
canvas.addEventListener('mousedown', (e) => {
    if (levelCompleted) return;
    audio.init();
    audio.resume();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = getTrainX();
    for (let i = 0; i < NUM_WAGONS; i++) {
        const wagonMidX = x + 60 - i * UNIT_SPACING;
        const worldX = distance + wagonMidX;
        const wagonY = (canvas.height - 80) - getTerrainHeight(worldX) - jumpY;

        // Check if clicked on wagon area (with hills)
        if (mouseX > wagonMidX - 60 && mouseX < wagonMidX + 60 && mouseY > wagonY - 60 && mouseY < wagonY + 20) {
            throwCoalFromWagon(i);
            return;
        }
    }
});

window.addEventListener('keydown', (e) => {
    if (levelCompleted) return;
    audio.init();
    audio.resume();

    if (!isKeyPressed) {
        if (!isGamepadBoostActive) {
            audio.playWhistle();
        }
        targetSpeed += 0.5; // Initial boost kick

        if (e.code === 'ArrowUp') {
            startJump();
        }
    }
    isKeyPressed = true;
    // Prevent scrolling for common keys like Space
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    isKeyPressed = false;
});

update();
