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

// 데스 스크린에서 '길드에서 부활하기' 버튼 클릭 시 스탯을 모두 회복시키고 길드 중앙으로 좌표를 옮깁니다.
function respawn() {
    player.currentHp = player.maxHp;
    player.currentStamina = player.maxStamina;
    player.currentMana = player.maxMana;
    player.x = 500; player.y = 500;
    currentMap = "guild";
    // 던전에 있던 몬스터(고블린)의 상태를 비활성화(어그로 해제) 시킵니다.
    if (typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        MAP_DATA.dungeon.goblin.active = false;
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

// 포탈을 타고 던전으로 진입할 때 몬스터를 활성화시키고 좌표를 재설정합니다.
function enterDungeon() {
    currentMap = "dungeon";
    player.x = 1500; player.y = 1500; 
    if (typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        MAP_DATA.dungeon.goblin.hp = MAP_DATA.dungeon.goblin.maxHp; 
        MAP_DATA.dungeon.goblin.x = 1500; MAP_DATA.dungeon.goblin.y = 1350;
        MAP_DATA.dungeon.goblin.active = true;
    }
    player.aimingSkill = null;
    player.dashTimer = 0;
    closeNPCMenu();
}

// 던전에서 다시 길드로 안전하게 귀환합니다.
function returnToGuild() {
    currentMap = "guild";
    player.x = 100; player.y = 350;
    if (typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        MAP_DATA.dungeon.goblin.active = false;
    }
    player.aimingSkill = null;
    player.dashTimer = 0;
    closeNPCMenu();
}
// [MOD-012-END]
