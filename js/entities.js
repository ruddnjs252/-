// [MOD-012: NPC 상호작용 및 맵 이동 이벤트 처리]
// [MOD-012-1: NPC 메뉴 열기 및 닫기]
// 길드 내 오브젝트(접수원, 포탈) 클릭 시 팝업을 띄우는 로직입니다.
function openNPCMenu(type) {
    gameState = "npcMenu";
    const ui = document.getElementById("npcMenuUI");
    const title = document.getElementById("npcMenuTitle");
    const content = document.getElementById("npcMenuContent");
    ui.style.display = "flex";

    if (type === 'receptionist') {
        title.innerText = "접수원";
        content.innerHTML = `
            <button class="btn" style="padding: 15px;" onclick="talkReceptionist()">대화하기</button>
            <button class="btn" style="padding: 15px; background: darkred;" onclick="attackReceptionist()">공격하기</button>
        `;
    } else if (type === 'receptionist_talk') {
        title.innerText = "접수원: 무엇을 도와드릴까요?";
        content.innerHTML = `
            <button class="btn" style="padding: 15px;" onclick="openCharCreation()">길드 가입 작성</button>
            <button class="btn" style="padding: 15px;" onclick="takeQuest()">퀘스트 받기</button>
        `;
    } else if (type === 'portal') {
        title.innerText = "포탈";
        content.innerHTML = `
            <button class="btn" style="padding: 15px; background: purple;" onclick="enterDungeon()">발러 던전 입장</button>
        `;
    } else if (type === 'dungeon_portal') {
        title.innerText = "귀환 포탈";
        content.innerHTML = `
            <button class="btn" style="padding: 15px; background: #0077cc;" onclick="returnToGuild()">길드로 귀환하기</button>
        `;
    } else if (type === 'dolpha') {
        title.innerText = "용병 돌프하";
        const isHired = (typeof dolpha !== "undefined" && dolpha.isFollowing);
        content.innerHTML = `
            <button class="btn" style="padding: 15px; background: ${isHired ? '#2e7d32' : '#0077cc'};" onclick="hireDolpha()">${isHired ? '동행 중' : '고용'}</button>
            <button class="btn" style="padding: 15px; background: #666;" onclick="dismissDolpha()">취소</button>
        `;
    }
}

function closeNPCMenu() {
    gameState = "playing"; // 메뉴를 닫고 조작 권한 반환
    document.getElementById("npcMenuUI").style.display = "none";
}

// [MOD-012-2: 대화, 공격, 퀘스트 수락 및 부활 액션]
function talkReceptionist() { openNPCMenu('receptionist_talk'); }

// 접수원을 공격하면 즉사 후 뒤로 밀려나는 연출(knockback)을 발생시킵니다.
function attackReceptionist() {
    closeNPCMenu();
    addFloatingText(player.x, player.y, "9999", "red");
    player.currentHp = 0;
    player.knockbackDirX = player.x < MAP_DATA.guild.receptionist.x ? -1 : 1;
    player.knockbackDirY = -0.5; 
    gameState = "knockback";
}

// ★ [던전 고블린 다수 스폰 관리]
const GOBLIN_SPAWN_POINTS = [
    { x: 1350, y: 1300 }, { x: 1650, y: 1300 },
    { x: 1250, y: 1500 }, { x: 1750, y: 1500 },
    { x: 1350, y: 1780 }, { x: 1650, y: 1780 },
    { x: 1180, y: 1180 }, { x: 1820, y: 1180 },
    { x: 1180, y: 1820 }, { x: 1820, y: 1820 },
    { x: 1500, y: 1080 }, { x: 1500, y: 1920 }
];

function spawnDungeonGoblins() {
    if (!MAP_DATA || !MAP_DATA.dungeon) return;
    MAP_DATA.dungeon.goblins = GOBLIN_SPAWN_POINTS.map((pt, idx) => ({
        id: "goblin_" + idx + "_" + Date.now(),
        x: pt.x,
        y: pt.y,
        size: 30,
        hp: 120,
        maxHp: 120,
        name: `고블린 lv${(idx % 3) + 1}`,
        speed: 0.65 + (idx % 4) * 0.08,
        damage: 2,
        expReward: 20,
        active: true
    }));
    if (MAP_DATA.dungeon.goblins.length > 0) {
        MAP_DATA.dungeon.goblin = MAP_DATA.dungeon.goblins[0];
    }
}
window.spawnDungeonGoblins = spawnDungeonGoblins;

// ★ [던전 보물 상자 스폰 관리]
const CHEST_SPAWN_POINTS = [
    { x: 1000, y: 1000 },
    { x: 2000, y: 1000 },
    { x: 1000, y: 2000 },
    { x: 2000, y: 2000 },
    { x: 1500, y: 980 }
];

function spawnDungeonChests() {
    if (!MAP_DATA || !MAP_DATA.dungeon) return;
    MAP_DATA.dungeon.chests = CHEST_SPAWN_POINTS.map((pt, idx) => ({
        id: "dungeon_chest_" + idx,
        x: pt.x - 18,
        y: pt.y - 18,
        w: 36,
        h: 36,
        opened: false,
        name: "보물상자"
    }));
}
window.spawnDungeonChests = spawnDungeonChests;

// 데스 스크린에서 '길드에서 부활하기' 클릭 시
function respawn() {
    player.currentHp = player.maxHp;
    player.currentStamina = player.maxStamina;
    player.currentMana = player.maxMana;
    player.x = 500; player.y = 500;
    currentMap = "guild";
    if (typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        MAP_DATA.dungeon.goblin.active = false;
        if (Array.isArray(MAP_DATA.dungeon.goblins)) {
            MAP_DATA.dungeon.goblins.forEach(g => g.active = false);
        }
    }
    player.aimingSkill = null;
    player.dashTimer = 0;
    gameState = "playing";
    document.getElementById("deathUI").style.display = "none";
}

function takeQuest() {
    quest.active = true;
    quest.current = 0;
    alert("퀘스트 수락: 고블린 10마리 잡기");
    closeNPCMenu();
}

// 포탈을 타고 던전으로 진입할 때 미로 몬스터 및 상자를 활성화
function enterDungeon() {
    currentMap = "dungeon";
    player.x = 1500; player.y = 1500; 
    spawnDungeonGoblins();
    spawnDungeonChests();
    player.aimingSkill = null;
    player.dashTimer = 0;
    closeNPCMenu();
}

// 던전에서 다시 길드로 안전하게 귀환
function returnToGuild() {
    currentMap = "guild";
    player.x = 100; player.y = 350;
    if (typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        MAP_DATA.dungeon.goblin.active = false;
        if (Array.isArray(MAP_DATA.dungeon.goblins)) {
            MAP_DATA.dungeon.goblins.forEach(g => g.active = false);
        }
    }
    player.aimingSkill = null;
    player.dashTimer = 0;
    closeNPCMenu();
}

// [MOD-012-3: 용병 돌프하 상호작용 및 AI 시스템]
function hireDolpha() {
    if (typeof dolpha !== "undefined") {
        dolpha.isFollowing = true;
        dolpha.currentMap = currentMap;
        if (typeof addFloatingText === "function") {
            addFloatingText(dolpha.x, dolpha.y - 20, "돌프하 고용!", "#4ade80");
        }
    }
    closeNPCMenu();
}

function dismissDolpha() {
    if (typeof dolpha !== "undefined") {
        dolpha.isFollowing = false;
        if (currentMap !== "guild") {
            dolpha.currentMap = "guild";
            dolpha.x = 840;
            dolpha.y = 65;
        }
        if (typeof addFloatingText === "function") {
            addFloatingText(dolpha.x, dolpha.y - 20, "고용 취소", "#94a3b8");
        }
    }
    closeNPCMenu();
}

// 매 프레임 실행되는 돌프하 추종 및 전투 AI 루프
function updateDolphaAI() {
    if (typeof dolpha === "undefined") return;

    if (dolpha.attackCooldown > 0) dolpha.attackCooldown--;
    if (dolpha.attackTimer > 0) dolpha.attackTimer--;

    // 고용되지 않은 경우: 제자리 대기
    if (!dolpha.isFollowing) {
        dolpha.walkTimer = 0;
        return;
    }

    // 맵 동기화: 플레이어가 맵 이동 시 함께 이동
    if (dolpha.currentMap !== currentMap) {
        dolpha.currentMap = currentMap;
        dolpha.x = player.x - 30;
        dolpha.y = player.y;
    }

    let targetGob = null;

    // 던전일 경우: 주변 260px 내 가장 가까운 활성 고블린 탐색
    if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
        let closestDist = 260;
        for (const gob of gobList) {
            if (!gob || !gob.active || gob.hp <= 0) continue;
            const dist = Math.hypot(gob.x - dolpha.x, gob.y - dolpha.y);
            if (dist < closestDist) {
                closestDist = dist;
                targetGob = gob;
            }
        }
    }

    // 1) 적이 감지된 경우: 고블린에게 돌진 및 자동 공격
    if (targetGob) {
        const dx = targetGob.x - dolpha.x;
        const dy = targetGob.y - dolpha.y;
        const dist = Math.hypot(dx, dy);

        if (Math.abs(dx) > Math.abs(dy)) {
            dolpha.facing = dx > 0 ? "right" : "left";
        } else {
            dolpha.facing = dy > 0 ? "down" : "up";
        }

        if (dist > 45) {
            dolpha.x += (dx / dist) * dolpha.speed;
            dolpha.y += (dy / dist) * dolpha.speed;
            dolpha.walkTimer += 0.25;
        } else {
            dolpha.walkTimer = 0;
            if (dolpha.attackCooldown <= 0) {
                dolpha.attackTimer = 16;
                dolpha.attackCooldown = 50; // 약 0.8초 쿨타임
                if (typeof applyDamageToGoblin === "function") {
                    applyDamageToGoblin(30, targetGob);
                }
                if (typeof addVisualEffect === "function") {
                    addVisualEffect(targetGob.x, targetGob.y, 25, "rgba(255, 255, 255, 0.8)");
                }
                if (typeof addFloatingText === "function") {
                    addFloatingText(dolpha.x, dolpha.y - 25, "돌프하 공격!", "#ff4444");
                }
            }
        }
        return;
    }

    // 2) 평상시: 플레이어를 일정 거리(75px) 유지하며 부드럽게 추종
    const pCenterX = player.x + player.width / 2;
    const pCenterY = player.y + player.height / 2;
    const dCenterX = dolpha.x + dolpha.width / 2;
    const dCenterY = dolpha.y + dolpha.height / 2;

    const dx = pCenterX - dCenterX;
    const dy = pCenterY - dCenterY;
    const distToPlayer = Math.hypot(dx, dy);

    if (distToPlayer > 75) {
        dolpha.x += (dx / distToPlayer) * dolpha.speed;
        dolpha.y += (dy / distToPlayer) * dolpha.speed;
        dolpha.walkTimer += 0.22;

        if (Math.abs(dx) > Math.abs(dy)) {
            dolpha.facing = dx > 0 ? "right" : "left";
        } else {
            dolpha.facing = dy > 0 ? "down" : "up";
        }
    } else {
        dolpha.walkTimer = 0;
    }
}
// [MOD-012-END]
