// 游戏常量
const CONFIG = {
    // 颜色
    colors: [
        0x67C23A, 0xE6A23C, 0xF56C6C, 0x909399,
        0x409EFF, 0xB83AF7, 0x19D4AE, 0x7B7C7D
    ],
    // 游戏参数
    jumpHeight: 100,         // 降低跳跃高度，更适合移动端
    jumpDuration: 0.8,       // 保持跳跃时间不变
    platformWidth: 60,       // 减小平台宽度
    platformHeight: 15,      // 减小平台高度
    platformDepth: 60,       // 减小平台深度
    characterSize: 12,       // 减小角色大小
    minDistance: 80,         // 减小最小距离
    maxDistance: 160,        // 减小最大距离
    cameraHeight: 120,       // 调整相机高度
    cameraDistance: 250,     // 调整相机距离
    gravity: 9.8,            // 保持重力不变
    perfectRange: 10         // 调整完美落地范围
};

// 游戏状态
const GAME_STATE = {
    READY: 'ready',
    CHARGING: 'charging',
    JUMPING: 'jumping',
    FALLING: 'falling',
    FALLING_TO_DEATH: 'fallingToDeath',
    GAME_OVER: 'gameOver'
};

// 游戏类
class JumpGame {
    constructor() {
        // 初始化游戏元素
        this.canvas = document.getElementById('gameCanvas');
        this.scoreElement = document.getElementById('score');
        this.bestScoreElement = document.getElementById('bestScore');
        this.finalScoreElement = document.getElementById('finalScore');
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.startButton = document.getElementById('startButton');
        this.restartButton = document.getElementById('restartButton');
        
        // 初始化粒子系统
        this.particles = [];
        
        // 初始化游戏数据
        this.score = 0;
        this.bestScore = localStorage.getItem('bestScore') || 0;
        this.bestScoreElement.textContent = this.bestScore;
        this.gameState = GAME_STATE.READY;
        this.platforms = [];
        this.currentPlatformIndex = 0;
        this.chargeStartTime = 0;
        this.jumpPower = 0;
        
        // 初始化跳跃动画对象
        this.jumpAnimation = {
            startTime: 0,
            startX: 0,
            startZ: 0,
            targetX: 0,
            targetZ: 0,
            directionX: 0,
            directionZ: 0,
            distance: 0,
            jumpDistance: 0
        }


        
        // 初始化事件监听
        this.initEventListeners();
        
        // 初始化Three.js场景
        this.initThreeJS();
        
        // 显示开始界面
        this.startScreen.style.display = 'block';
    }


    
    // 初始化事件监听
    initEventListeners() {
        // 开始按钮
        this.startButton.addEventListener('click', () => this.startGame());
        
        // 重新开始按钮
        this.restartButton.addEventListener('click', () => this.restartGame());
        
        // 触摸/鼠标事件
        this.canvas.addEventListener('mousedown', () => this.onPointerDown());
        this.canvas.addEventListener('mouseup', () => this.onPointerUp());
        this.canvas.addEventListener('mouseleave', () => this.onPointerUp()); // 鼠标离开时也触发释放
        
        // 触摸事件 - 针对移动设备优化
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.onPointerDown();
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.onPointerUp();
        }, { passive: false });
        
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.onPointerUp();
        }, { passive: false });
        
        // 窗口大小调整
        window.addEventListener('resize', () => this.onWindowResize());
    }


    
    // 初始化Three.js场景
    initThreeJS() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // 创建相机
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
        this.camera.position.set(0, CONFIG.cameraHeight * 1.2, CONFIG.cameraDistance); // 调整初始相机位置，更高的视角
        this.camera.lookAt(0, 0, 0);
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // 添加光源
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 500, 300);
        this.scene.add(directionalLight);
        
        // 创建角色
        this.createCharacter();
        
        // 开始动画循环
        this.animate();
    }


    
    // 创建角色
    createCharacter() {
        const geometry = new THREE.BoxGeometry(
            CONFIG.characterSize,
            CONFIG.characterSize,
            CONFIG.characterSize
        );
        const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        this.character = new THREE.Mesh(geometry, material);
        this.scene.add(this.character);
        
        // 设置角色初始位置
        this.character.position.y = CONFIG.platformHeight + CONFIG.characterSize / 2;
    }


    
    // 创建平台
    createPlatform(x, z, isFirst = false) {
        const geometry = new THREE.BoxGeometry(
            CONFIG.platformWidth,
            CONFIG.platformHeight,
            CONFIG.platformDepth
        );
        
        // 随机选择颜色
        const colorIndex = Math.floor(Math.random() * CONFIG.colors.length);
        const material = new THREE.MeshLambertMaterial({ color: CONFIG.colors[colorIndex] });
        
        const platform = new THREE.Mesh(geometry, material);
        platform.position.set(x, 0, z);
        this.scene.add(platform);
        
        // 添加到平台数组
        this.platforms.push({
            mesh: platform,
            x: x,
            z: z,
            width: CONFIG.platformWidth,
            depth: CONFIG.platformDepth
        });


        
        // 如果是第一个平台，放置角色在上面
        if (isFirst) {
            this.character.position.x = x;
            this.character.position.z = z;
        }


        
        return platform;
    }


    
    // 生成下一个平台
    generateNextPlatform() {
        const currentPlatform = this.platforms[this.currentPlatformIndex];
        
        // 主要生成在x轴正方向，偶尔有少许z轴偏移
        const distance = CONFIG.minDistance + Math.random() * (CONFIG.maxDistance - CONFIG.minDistance);
        
        let x = currentPlatform.x + distance; // 始终向右
        let z = currentPlatform.z + (Math.random() - 0.5) * distance * 0.3; // 少许z轴随机偏移
        
        this.createPlatform(x, z);
        // 移除这里的索引增加，因为在checkLanding中已经增加了
        // this.currentPlatformIndex++;
        
        // 不再在这里更新相机位置，而是在updateJump中实时跟随角色
    }


    
    // 开始游戏
    startGame() {
        this.startScreen.style.display = 'none';
        this.gameOverScreen.style.display = 'none';
        this.gameState = GAME_STATE.READY;
        this.score = 0;
        this.scoreElement.textContent = '0';
        this.explosionCreated = false;
        
        // 清除所有粒子
        this.particles.forEach(particle => {
            this.scene.remove(particle);
        });
        this.particles = [];

        // 清除现有平台
        this.platforms.forEach(platform => {
            this.scene.remove(platform.mesh);
        });
        this.platforms = [];
        
        // 重置角色位置和可见性
        if (this.character) {
            this.character.visible = true;
            this.character.rotation.x = 0;
            this.character.rotation.y = 0;
            this.character.position.set(0, CONFIG.platformHeight + CONFIG.characterSize / 2, 0);
        }
        
        // 重置相机位置
        this.camera.position.set(0, CONFIG.cameraHeight * 1.2, CONFIG.cameraDistance);
        this.camera.lookAt(0, 0, 0);
        
        // 创建初始平台
        this.createPlatform(0, 0, true);
        this.currentPlatformIndex = 0;
        
        // 生成第二个平台
        this.generateNextPlatform();
    }


    
    // 重新开始游戏
    restartGame() {
        this.startGame();
    }


    
    // 游戏结束
    gameOver() {
        this.gameState = GAME_STATE.GAME_OVER;
        
        // 更新最高分
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.bestScoreElement.textContent = this.bestScore;
            localStorage.setItem('bestScore', this.bestScore);
        }


        
        // 显示游戏结束界面
        this.finalScoreElement.textContent = this.score;
        this.gameOverScreen.style.display = 'block';
    }


    
    // 按下鼠标/触摸屏幕
    onPointerDown() {
        console.log('按下事件触发，当前游戏状态:', this.gameState);
        if (this.gameState === GAME_STATE.READY || this.gameState === GAME_STATE.FALLING) {
            this.gameState = GAME_STATE.CHARGING;
            this.chargeStartTime = Date.now();
            console.log('进入蓄力状态，开始时间:', this.chargeStartTime);
        }


    }



    // 释放鼠标/触摸屏幕
    onPointerUp() {
        console.log('松开事件触发，当前游戏状态:', this.gameState);
        if (this.gameState === GAME_STATE.CHARGING) {
            // 计算蓄力时间和跳跃力量
            const chargeTime = (Date.now() - this.chargeStartTime) / 1000; // 转换为秒
            this.jumpPower = Math.min(chargeTime * 2, 1); // 最大为1
            console.log('蓄力时间:', chargeTime, '跳跃力量:', this.jumpPower);
            
            // 检查是否有下一个平台
            if (this.currentPlatformIndex + 1 < this.platforms.length) {
                // 开始跳跃
                this.jump();
            } else {
                console.error('没有下一个平台可跳跃');
                this.gameState = GAME_STATE.READY;
            }


        }


    }



    // 跳跃
    jump() {
        console.log('开始跳跃，当前平台索引:', this.currentPlatformIndex);
        
        // 检查是否有下一个平台
        if (this.currentPlatformIndex + 1 >= this.platforms.length) {
            console.error('没有下一个平台可跳跃');
            return;
        }


        
        this.gameState = GAME_STATE.JUMPING;
        
        // 计算目标平台
        const currentPlatform = this.platforms[this.currentPlatformIndex];
        const targetPlatform = this.platforms[this.currentPlatformIndex + 1];
        
        // 计算方向和距离
        const deltaX = targetPlatform.x - currentPlatform.x;
        const deltaZ = targetPlatform.z - currentPlatform.z;
        const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
        
        // 计算实际跳跃距离（优化蓄力与跳跃距离的关系）
        const jumpDistance = distance * (0.7 + this.jumpPower * 0.5); // 修改跳跃距离计算，使距离更可控
        
        // 计算跳跃方向
        const directionX = deltaX / distance;
        const directionZ = deltaZ / distance;
        
        // 设置动画参数
        this.jumpAnimation = {
            startTime: Date.now(),
            startX: this.character.position.x,
            startZ: this.character.position.z,
            targetX: this.character.position.x + directionX * jumpDistance,
            targetZ: this.character.position.z + directionZ * jumpDistance,
            directionX: directionX,
            directionZ: directionZ,
            distance: distance,
            jumpDistance: jumpDistance
        };


    }


    
    // 更新跳跃动画
    updateJump() {
        // 检查jumpAnimation是否已正确初始化
        if (!this.jumpAnimation || this.jumpAnimation.startTime === undefined) {
            console.error('跳跃动画未正确初始化');
            this.gameState = GAME_STATE.READY;
            return;
        }


        
        const now = Date.now();
        const elapsed = (now - this.jumpAnimation.startTime) / 1000; // 转换为秒
        const progress = Math.min(elapsed / CONFIG.jumpDuration, 1);
        
        // 使用缓动函数使动画更自然
        const easeProgress = this.easeInOutQuad(progress);
        
        // 更新角色位置
        this.character.position.x = this.jumpAnimation.startX + (this.jumpAnimation.targetX - this.jumpAnimation.startX) * easeProgress;
        this.character.position.z = this.jumpAnimation.startZ + (this.jumpAnimation.targetZ - this.jumpAnimation.startZ) * easeProgress;
        
        // 计算跳跃高度（抛物线）
        const jumpHeight = Math.sin(easeProgress * Math.PI) * CONFIG.jumpHeight;
        this.character.position.y = CONFIG.platformHeight + CONFIG.characterSize / 2 + jumpHeight;
        
        // 旋转角色
        this.character.rotation.y += 0.1;
        
        // 更新相机位置以从侧面观察角色
        this.camera.position.z = this.character.position.z; // 相机位于角色侧面
        this.camera.position.x = this.character.position.x - CONFIG.cameraDistance * 0.8; // 相机位于角色左侧
        this.camera.position.y = CONFIG.cameraHeight * 1.2; // 稍微提高相机高度
        this.camera.lookAt(this.character.position.x + 150, 0, this.character.position.z); // 相机看向角色右侧，确保能看到下一个平台
        
        // 跳跃结束
        if (progress >= 1) {
            this.gameState = GAME_STATE.FALLING;
            this.checkLanding();
        }


    }


    
    // 检查着陆
    checkLanding() {
        const characterX = this.character.position.x;
        const characterZ = this.character.position.z;
        
        // 检查是否落在当前平台上（原地跳跃的情况）
        const currentPlatform = this.platforms[this.currentPlatformIndex];
        const currentHalfWidth = currentPlatform.width / 2;
        const currentHalfDepth = currentPlatform.depth / 2;
        
        if (
            characterX >= currentPlatform.x - currentHalfWidth &&
            characterX <= currentPlatform.x + currentHalfWidth &&
            characterZ >= currentPlatform.z - currentHalfDepth &&
            characterZ <= currentPlatform.z + currentHalfDepth
        ) {
            // 原地跳跃，重置位置和状态
            this.character.position.y = CONFIG.platformHeight + CONFIG.characterSize / 2;
            this.gameState = GAME_STATE.READY;
            return;
        }

        // 检查是否落在下一个平台上
        const targetPlatform = this.platforms[this.currentPlatformIndex + 1];
        const halfWidth = targetPlatform.width / 2;
        const halfDepth = targetPlatform.depth / 2;
        
        if (
            characterX >= targetPlatform.x - halfWidth &&
            characterX <= targetPlatform.x + halfWidth &&
            characterZ >= targetPlatform.z - halfDepth &&
            characterZ <= targetPlatform.z + halfDepth
        ) {
            // 成功着陆
            this.character.position.y = CONFIG.platformHeight + CONFIG.characterSize / 2;
            this.currentPlatformIndex++;
            
            // 计算得分（距离中心点越近得分越高）
            const distanceToCenter = Math.sqrt(
                Math.pow(characterX - targetPlatform.x, 2) +
                Math.pow(characterZ - targetPlatform.z, 2)
            );
            
            // 计算得分
            const perfectBonus = distanceToCenter < CONFIG.perfectRange ? 2 : 1; // 完美落地奖励
            this.score += Math.floor(10 * perfectBonus);
            this.scoreElement.textContent = this.score;
            
            // 生成下一个平台
            this.generateNextPlatform();
            
            // 移除过远的平台（优化性能）
            if (this.platforms.length > 3) {
                const oldPlatform = this.platforms.shift();
                this.scene.remove(oldPlatform.mesh);
                this.currentPlatformIndex--;
            }
            
            // 重置游戏状态
            this.gameState = GAME_STATE.READY;
        } else {
            // 直接创建爆炸效果并结束游戏，不再进入掉落状态
            this.createExplosion();
            this.character.visible = false;
            this.gameOver();
        }
    }


    
    // 缓动函数
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }


    
    // 窗口大小调整
    onWindowResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }


    
    // 更新掉落动画
    updateFall() {
        const now = Date.now();
        const elapsed = (now - this.fallStartTime) / 1000; // 转换为秒
        
        // 使用重力公式计算下落距离
        const fallDistance = 0.5 * CONFIG.gravity * elapsed * elapsed;
        this.character.position.y = this.fallStartY - fallDistance;
        
        // 旋转角色
        this.character.rotation.x += 0.1;
        
        // 检查是否掉出屏幕
        if (this.character.position.y < -200) {
            // 创建爆炸效果
            if (!this.explosionCreated) {
                this.createExplosion();
                this.explosionCreated = true;
            }
            
            // 隐藏角色
            this.character.visible = false;
            
            // 延迟显示游戏结束界面
            setTimeout(() => this.gameOver(), 1500);
        }
    }

    // 动画循环
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 根据游戏状态更新
        if (this.gameState === GAME_STATE.JUMPING) {
            this.updateJump();
        }
        
        // 更新粒子效果
        this.updateParticles();
        
        // 渲染场景
        this.renderer.render(this.scene, this.camera);
    }


    // 创建爆炸效果
    createExplosion() {
        const particleCount = 50;
        const colors = [0xff0000, 0xff7700, 0xffff00]; // 爆炸粒子的颜色
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(2, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true
            });
        
            const particle = new THREE.Mesh(geometry, material);
        
            // 设置粒子初始位置（在角色位置）
            particle.position.copy(this.character.position);
        
            // 设置随机速度
            const speed = 2 + Math.random() * 4;
            const angle = Math.random() * Math.PI * 2;
            const elevation = -Math.PI/2 + Math.random() * Math.PI;
        
            particle.velocity = new THREE.Vector3(
                speed * Math.cos(angle) * Math.cos(elevation),
                speed * Math.sin(elevation),
                speed * Math.sin(angle) * Math.cos(elevation)
            );
        
            particle.birthTime = Date.now();
            particle.lifetime = 1000 + Math.random() * 1000; // 1-2秒的生命周期
        
            this.scene.add(particle);
            this.particles.push(particle);
        }
    }
    
    // 更新粒子效果
    updateParticles() {
        const now = Date.now();
        const particlesToRemove = [];
        
        // 先收集需要移除的粒子
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const age = now - particle.birthTime;
        
            if (age > particle.lifetime) {
                // 标记过期粒子
                particlesToRemove.push(i);
                continue;
            }
        
            // 更新位置
            particle.position.add(particle.velocity);
        
            // 添加重力效果
            particle.velocity.y -= CONFIG.gravity * 0.02;
        
            // 淡出效果
            const lifeRatio = 1 - age / particle.lifetime;
            particle.material.opacity = lifeRatio;
        }
        
        // 从后向前移除粒子，避免索引变化问题
        for (let i = particlesToRemove.length - 1; i >= 0; i--) {
            const index = particlesToRemove[i];
            const particle = this.particles[index];
            this.scene.remove(particle);
            this.particles.splice(index, 1);
        }
    }
}

// 创建并启动游戏
window.addEventListener('DOMContentLoaded', () => {
    new JumpGame();
});