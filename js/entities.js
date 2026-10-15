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
// [MOD-012-END]
