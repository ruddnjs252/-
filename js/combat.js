// [MOD-015: 스킬 시스템 및 전투 연산 로직]
// [MOD-015-0: 타격 이펙트 및 플로팅 텍스트 유틸리티]
function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x: x + (Math.random() * 20 - 10), y: y - 10, text: text, color: color, alpha: 1.0, timer: 30 });
}

function addVisualEffect(x, y, radius, color) {
    visualEffects.push({ x: x, y: y, radius: radius, color: color, alpha: 0.6, timer: 15 });
}

// [MOD-015-1: 스킬 데이터 모형 및 퀵슬롯 초기화]
const MOCK_SKILLS = {
    leap: { id: "leap", name: "도약", type: "leap_only", cooldown: 2, bonusDmg: 0 },
    charge: { id: "charge", name: "돌진", type: "charge", cooldown: 3, bonusDmg: 10 },
    slam: { id: "slam", name: "강타", type: "jump_slam", cooldown: 5, bonusDmg: 20 },
    slash: { id: "slash", name: "베기", type: "slash", cooldown: 1, bonusDmg: 5 },
    heal: { id: "heal", name: "치료", type: "heal", cooldown: 10, bonusDmg: 0 },
    fire: { id: "fire", name: "화염", type: "fire", cooldown: 4, bonusDmg: 15 },
    ice: { id: "ice", name: "얼음", type: "ice", cooldown: 4, bonusDmg: 12 },
    wind: { id: "wind", name: "바람", type: "wind", cooldown: 3, bonusDmg: 8 },
    teleport: { id: "teleport", name: "순간이동", type: "teleport", cooldown: 5, bonusDmg: 0 },
    rapid_shot: { id: "rapid_shot", name: "속공", type: "rapid_shot", cooldown: 6, bonusDmg: 20 }
};

if (!player.quickSlots) {
    // [기본 해금 스킬 5종을 사다리 퀵슬롯에 기본 배치하여 시작부터 스킬 사용 가능]
    player.quickSlots = [
        MOCK_SKILLS["leap"] || null,
        MOCK_SKILLS["charge"] || null,
        MOCK_SKILLS["slam"] || null,
        MOCK_SKILLS["slash"] || null,
        MOCK_SKILLS["heal"] || null
    ];
    player.currentQuickSlotIdx = 0;
    player.lockedTarget = null;
}

// ★ 습득 스킬 및 알림 뱃지 관리 변수
if (!player.unlockedSkills) {
    player.unlockedSkills = ["leap", "charge", "slam", "slash", "heal", "fire", "ice", "wind"];
}
if (!player.newlyAcquiredSkills) {
    player.newlyAcquiredSkills = [];
}

player.width = 44;
player.height = 44;

function getActiveQuickSlotSkill() {
    return player.quickSlots[player.currentQuickSlotIdx];
}

// [MOD-015-2: 사다리형 UI 회전 로직]
// R키: 오른쪽(다음 스킬)으로 회전
function handleRKey() {
    if (gameState !== "playing" || player.dashTimer > 0) return;
    
    const N = player.quickSlots.length;
    if (N > 0) {
        player.currentQuickSlotIdx = (player.currentQuickSlotIdx + 1) % N;
        player.aimingSkill = null; 
        updateQuickSlotUI(); 
    }
}

// E키: 왼쪽(이전 스킬)으로 회전
function handleEKey() {
    if (gameState !== "playing" || player.dashTimer > 0) return;
    
    const N = player.quickSlots.length;
    if (N > 0) {
        player.currentQuickSlotIdx = (player.currentQuickSlotIdx - 1 + N) % N;
        player.aimingSkill = null; 
        updateQuickSlotUI(); 
    }
}

function updateQuickSlotUI() {
    const N = player.quickSlots.length;
    if (N === 0) return;

    const centerIdx = player.currentQuickSlotIdx;
    
    // 화면에 보여줄 5개의 스킬 인덱스 계산 (좌측 2개, 중앙, 우측 2개)
    const displayIndices = [
        (centerIdx - 2 + N) % N,
        (centerIdx - 1 + N) % N,
        centerIdx,
        (centerIdx + 1) % N,
        (centerIdx + 2) % N
    ];

    for (let i = 0; i < 5; i++) {
        let slot = document.getElementById("q-slot-" + i);
        let inner = slot ? slot.querySelector('.q-slot-inner') : null;
        if (!slot || !inner) continue;
        
        let skillIdx = displayIndices[i];
        let skill = player.quickSlots[skillIdx];
        
        inner.innerHTML = skill ? skill.name : "";

        // 순서에 맞게 클래스(디자인)를 다시 배정하여 밀려가는 효과를 줌
        slot.className = "q-slot-ladder";
        if (i === 0 || i === 4) slot.classList.add("q-slot-far");
        else if (i === 1 || i === 3) slot.classList.add("q-slot-side");
        else if (i === 2) slot.classList.add("q-slot-center");
    }
}
// [MOD-015-2-END]

// [MOD-015-3: 기본 공격 및 스킬 조준/발동 로직]

// [활 장착 시 퀵슬롯 가운데 위 화살 수량 표시 UI 갱신]
function updateArrowCountUI() {
    const el = document.getElementById("arrow-count-display");
    if (!el) return;

    if (typeof player === "undefined" || !player.equipment) {
        el.style.display = "none";
        return;
    }

    const wpn = player.equipment.mainWeapon;
    const isBow = wpn && (wpn.baseId === "bow_basic" || (typeof ITEM_DB !== "undefined" && ITEM_DB[wpn.baseId]?.weaponType === "bow"));

    if (!isBow) {
        el.style.display = "none";
        return;
    }

    const totalArrows = typeof getTotalArrowCount === "function" ? getTotalArrowCount() : 0;
    el.style.display = "block";
    el.innerText = `🏹 화살: ${totalArrows}개`;

    if (totalArrows <= 0) {
        el.classList.add("empty-arrow");
    } else {
        el.classList.remove("empty-arrow");
    }
}
window.updateArrowCountUI = updateArrowCountUI;

// [활 차징 공격 시스템]
function startBowCharging() {
    const wpn = player.equipment?.mainWeapon;
    const isBow = wpn && (wpn.baseId === "bow_basic" || (typeof ITEM_DB !== "undefined" && ITEM_DB[wpn.baseId]?.weaponType === "bow"));
    if (!isBow) return false;

    const totalArrows = typeof getTotalArrowCount === "function" ? getTotalArrowCount() : 0;
    if (totalArrows <= 0) {
        if (typeof addFloatingText === "function") {
            addFloatingText(player.x, player.y - 30, "화살이 없습니다!", "red");
        }
        return false;
    }

    isBowCharging = true;
    bowChargeTime = 0;
    bowChargeRatio = 0;
    return true;
}
window.startBowCharging = startBowCharging;

function cancelBowCharging() {
    isBowCharging = false;
    bowChargeTime = 0;
    bowChargeRatio = 0;
}
window.cancelBowCharging = cancelBowCharging;

function releaseBowShot(wMouseX, wMouseY) {
    if (!isBowCharging) return false;

    const wpn = player.equipment?.mainWeapon;
    const isBow = wpn && (wpn.baseId === "bow_basic" || (typeof ITEM_DB !== "undefined" && ITEM_DB[wpn.baseId]?.weaponType === "bow"));
    if (!isBow) {
        cancelBowCharging();
        return false;
    }

    const ratio = Math.min(1.0, bowChargeRatio);
    isBowCharging = false;
    bowChargeTime = 0;
    bowChargeRatio = 0;

    const pCenterX = player.x + player.width / 2;
    const pCenterY = player.y + player.height / 2;
    const clickAngle = Math.atan2(wMouseY - pCenterY, wMouseX - pCenterX);

    // ★ 구간 3: 5분의 5 (0.80 ~ 1.00) = 빨간색 실패 구간!
    if (ratio >= 0.8) {
        if (typeof addFloatingText === "function") {
            addFloatingText(player.x, player.y - 30, "공격 실패!", "#ff3333");
        }
        attackTimer = 15;
        player.lastAttackAngle = clickAngle;
        return false;
    }

    // 화살 유무 재확인
    const totalArrows = typeof getTotalArrowCount === "function" ? getTotalArrowCount() : 0;
    if (totalArrows <= 0) {
        if (typeof addFloatingText === "function") {
            addFloatingText(player.x, player.y - 30, "화살이 없습니다!", "red");
        }
        return false;
    }

    // 화살 1개 소모
    if (typeof consumeArrow === "function") consumeArrow();

    attackTimer = 20;
    player.lastAttackAngle = clickAngle;

    // 주무기 소켓에서 인챈트 확인 (homing, split 검사)
    let hasHoming = false, hasSplit = false;
    if (wpn && Array.isArray(wpn.sockets)) {
        hasHoming = wpn.sockets.some(s => {
            if (!s) return false;
            let bId = typeof s === "string" ? s : s.baseId;
            return bId === 'scroll_homing' || ITEM_DB[bId]?.enchantEffect?.type === 'homing';
        });
        hasSplit = wpn.sockets.some(s => {
            if (!s) return false;
            let bId = typeof s === "string" ? s : s.baseId;
            return bId === 'scroll_split' || ITEM_DB[bId]?.enchantEffect?.type === 'split';
        });
    }

    let arrowSpeed = 14;
    let maxDist = 380;
    let arrowDmg = (player.stats.str * 2) + 8;
    let effectColor = "#FFD700";

    // ★ 구간 2: 5분의 4 (0.60 ~ 0.80) = 녹색 퍼펙트 구간!
    if (ratio >= 0.6) {
        arrowSpeed = 24;
        maxDist = 650;
        arrowDmg = (player.stats.str * 2) + 26; // 강력한 최대 공격력
        effectColor = "#00FF66";
        if (typeof addFloatingText === "function") {
            addFloatingText(player.x, player.y - 35, "PERFECT SHOT!", "#00FF66");
        }
    } else {
        // ★ 구간 1: 5분의 3 (0.00 ~ 0.60) = 노란색 약한 공격 구간
        arrowSpeed = 14;
        maxDist = 380;
        arrowDmg = (player.stats.str * 2) + 8;
        effectColor = "#FFD700";
    }

    if (typeof projectiles !== "undefined") {
        // 1. 메인 화살 생성 (isPickable: true -> 빗나가거나 사거리 다하면 필드 회수 가능!)
        projectiles.push({
            type: "arrow",
            x: pCenterX + Math.cos(clickAngle) * 20,
            y: pCenterY + Math.sin(clickAngle) * 20,
            vx: Math.cos(clickAngle) * arrowSpeed,
            vy: Math.sin(clickAngle) * arrowSpeed,
            angle: clickAngle,
            traveled: 0,
            maxDist: maxDist,
            damage: arrowDmg,
            isHoming: hasHoming,
            isPickable: true // 땅에 박혀 줍기 가능!
        });

        // 2. [분열] 인챈트: 부채꼴 좌우 2발 추가 발사
        if (hasSplit) {
            [-0.24, 0.24].forEach(spread => {
                const spAngle = clickAngle + spread;
                projectiles.push({
                    type: "arrow",
                    x: pCenterX + Math.cos(spAngle) * 20,
                    y: pCenterY + Math.sin(spAngle) * 20,
                    vx: Math.cos(spAngle) * arrowSpeed,
                    vy: Math.sin(spAngle) * arrowSpeed,
                    angle: spAngle,
                    traveled: 0,
                    maxDist: maxDist,
                    damage: Math.floor(arrowDmg * 0.85),
                    isHoming: hasHoming,
                    isPickable: false // ★ 분열로 늘어난 화살은 주울 수 없음!
                });
            });
        }
    }

    if (typeof addVisualEffect === "function") {
        addVisualEffect(pCenterX, pCenterY, ratio >= 0.6 ? 24 : 14, effectColor);
    }
    return true;
}
window.releaseBowShot = releaseBowShot;

// [좌클릭 기본 공격 로직: 근접 무기(검/도끼/지팡이)]
function executeBasicAttack(wMouseX, wMouseY) {
    if (typeof attackTimer !== 'undefined' && attackTimer > 0) return false;

    const wpn = player.equipment?.mainWeapon;
    const isBow = wpn && (wpn.baseId === "bow_basic" || (typeof ITEM_DB !== "undefined" && ITEM_DB[wpn.baseId]?.weaponType === "bow"));
    if (isBow) {
        // 활은 차징 릴리즈 시스템으로 동작
        return false;
    }

    const pCenterX = player.x + player.width / 2;
    const pCenterY = player.y + player.height / 2;
    const clickAngle = Math.atan2(wMouseY - pCenterY, wMouseX - pCenterX);

    attackTimer = 30; // 스윙 애니메이션 및 기본 공격 쿨타임 (30프레임 = 0.5초)
    player.lastAttackAngle = clickAngle;

    const baseRange = 85;
    const totalDmg = (player.stats.str * 3) + 5;

    // 던전 고블린 적중 판정 (사거리 내 + 마우스 부채꼴 방향 판정)
    if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
        gobList.forEach(gob => {
            if (!gob.active) return;
            const dist = Math.hypot(gob.x - pCenterX, gob.y - pCenterY);
            if (dist <= baseRange + gob.size / 2) {
                let angleToGob = Math.atan2(gob.y - pCenterY, gob.x - pCenterX);
                let diffAngle = Math.abs(clickAngle - angleToGob);
                if (diffAngle > Math.PI) diffAngle = 2 * Math.PI - diffAngle;

                if (diffAngle < Math.PI * 0.45 || player.lockedTarget === gob) {
                    applyDamageToGoblin(totalDmg, gob);
                }
            }
        });
    }
    return true;
}

// 마우스 우클릭 시 현재 선택된 슬롯의 스킬 쿨타임을 점검하고 조준(aiming) 상태로 전환합니다.
function aimCurrentQuickSlot() {
    const activeSkill = getActiveQuickSlotSkill();
    if (!activeSkill) { addFloatingText(player.x, player.y - 10, "빈 슬롯입니다.", "gray"); return; }
    let cd = player.skillCooldowns[activeSkill.id] || 0;
    if (cd > 0) { addFloatingText(player.x, player.y - 10, `${activeSkill.name} 쿨타임!`, "yellow"); return; }
    player.aimingSkill = activeSkill.type;
    addFloatingText(player.x, player.y - 30, `[${activeSkill.name}] 조준 중...`, "cyan");
}

function startSkillCooldown(skillId, cooldownSec) {
    player.skillCooldowns[skillId] = cooldownSec * 60; // 60프레임 = 1초
}

// 마우스 좌클릭 시 조준 중이던 스킬을 마우스 커서 위치(월드 좌표)로 발사/이동시킵니다.
function executeAimingSkill() {
    const activeSkill = getActiveQuickSlotSkill();
    if (!activeSkill) return false;

    let wMouseX = mouseX + camera.x;
    let wMouseY = mouseY + camera.y;
    const pCenterX = player.x;
    const pCenterY = player.y;
    const aimAngle = Math.atan2(wMouseY - pCenterY, wMouseX - pCenterX);
    const playerRadius = player.width / 2;

    // 이동계 스킬 1: 도약 (마우스 방향으로 짧고 빠르게 전진)
    if (player.aimingSkill === "leap_only") {
        startSkillCooldown(activeSkill.id, activeSkill.cooldown);
        player.dashSpeed = 15;
        player.dashDirX = Math.cos(aimAngle);
        player.dashDirY = Math.sin(aimAngle);
        player.dashTimer = 6;
        player.activeSkillType = "leap_only";
        addVisualEffect(pCenterX, pCenterY, 30, "cyan");
        player.aimingSkill = null;
        return true;
    }
    // 이동+공격계 스킬: 강타 (마우스 커서 지점으로 텔레포트하듯 점프 후 착지 딜레이/데미지)
    else if (player.aimingSkill === "jump_slam") {
        startSkillCooldown(activeSkill.id, activeSkill.cooldown);
        let targetX = Math.max(playerRadius, Math.min(WORLD_WIDTH - playerRadius, wMouseX));
        let targetY = Math.max(playerRadius, Math.min(WORLD_HEIGHT - playerRadius, wMouseY));
        
        // 장애물이 없다면 즉시 좌표 이동
        if (!checkObstacleCollision(targetX - playerRadius, targetY - playerRadius)) {
            player.x = targetX;
            player.y = targetY;
        }
        const slamX = player.x;
        const slamY = player.y;
        addVisualEffect(slamX, slamY, 80, "red"); // 붉은 파장 생성

        const totalDmg = (player.stats.str * 3) + activeSkill.bonusDmg;
        // 고블린이 범위 내에 있다면 광역 데미지
        if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
            const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
            gobList.forEach(gob => {
                if (!gob.active) return;
                if (Math.hypot(gob.x - slamX, gob.y - slamY) < 80 + gob.size / 2) {
                    applyDamageToGoblin(totalDmg, gob);
                }
            });
        }
        player.aimingSkill = null;
        return true;
    } 
    // 이동+공격계 스킬: 돌진 (마우스 커서 방향으로 긴 거리를 쭉 밀고 나감)
    else if (player.aimingSkill === "charge") {
        startSkillCooldown(activeSkill.id, activeSkill.cooldown);
        const dx = wMouseX - pCenterX;
        const dy = wMouseY - pCenterY;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
            const speed = 22; 
            player.dashSpeed = speed;
            player.dashDirX = dx / dist;
            player.dashDirY = dy / dist;
            player.dashTimer = Math.min(40, Math.ceil(dist / speed));
            player.targetX = wMouseX;
            player.targetY = wMouseY;
            player.activeSkillType = "charge";
            addVisualEffect(pCenterX, pCenterY, 40, "yellow");
        }
        player.aimingSkill = null;
        return true;
    }
    // ★ 이동계 스킬 2: 순간이동 (마우스 방향으로 일정 거리 즉시 이동)
    else if (player.aimingSkill === "teleport") {
        startSkillCooldown(activeSkill.id, activeSkill.cooldown);
        
        const maxDist = 250; // 최대 순간이동 거리 (사거리)
        const dx = wMouseX - pCenterX;
        const dy = wMouseY - pCenterY;
        const dist = Math.hypot(dx, dy);
        
        let targetX = wMouseX;
        let targetY = wMouseY;
        
        // 사거리를 벗어났으면 최대 사거리 지점으로 보정
        if (dist > maxDist) {
            targetX = pCenterX + (dx / dist) * maxDist;
            targetY = pCenterY + (dy / dist) * maxDist;
        }
        
        // 맵 경계선 뚫기 방지
        targetX = Math.max(playerRadius, Math.min(WORLD_WIDTH - playerRadius, targetX));
        targetY = Math.max(playerRadius, Math.min(WORLD_HEIGHT - playerRadius, targetY));
        
        // 벽(장애물) 충돌 검사
        if (!checkObstacleCollision(targetX - playerRadius, targetY - playerRadius)) {
            addVisualEffect(player.x, player.y, 40, "purple"); // 사라질 때 보라색 파장
            player.x = targetX;
            player.y = targetY;
            addVisualEffect(player.x, player.y, 40, "cyan");   // 나타날 때 하늘색 파장
        } else {
            addFloatingText(player.x, player.y - 20, "막힌 공간입니다!", "red");
        }
        
        player.aimingSkill = null;
        return true;
    }
    // ★ 활 스킬: 속공 (3발의 화살을 가장 강력한 공격력으로 순간 연속 발사)
    else if (player.aimingSkill === "rapid_shot") {
        const totalArrows = typeof getTotalArrowCount === "function" ? getTotalArrowCount() : 0;
        if (totalArrows < 1) {
            addFloatingText(player.x, player.y - 20, "화살이 없습니다!", "red");
            player.aimingSkill = null;
            return false;
        }

        startSkillCooldown(activeSkill.id, activeSkill.cooldown);

        const wpn = player.equipment?.mainWeapon;
        let hasHoming = false, hasSplit = false;
        if (wpn && Array.isArray(wpn.sockets)) {
            hasHoming = wpn.sockets.some(s => {
                if (!s) return false;
                let bId = typeof s === "string" ? s : s.baseId;
                return bId === 'scroll_homing' || ITEM_DB[bId]?.enchantEffect?.type === 'homing';
            });
            hasSplit = wpn.sockets.some(s => {
                if (!s) return false;
                let bId = typeof s === "string" ? s : s.baseId;
                return bId === 'scroll_split' || ITEM_DB[bId]?.enchantEffect?.type === 'split';
            });
        }

        const dx = wMouseX - pCenterX;
        const dy = wMouseY - pCenterY;
        const baseAngle = Math.atan2(dy, dx);
        const arrowSpeed = 26;
        const maxDist = 650;
        const arrowDmg = (player.stats.str * 2) + 26 + activeSkill.bonusDmg; // 가장 강력한 데미지

        const shotCount = Math.min(3, totalArrows);
        for (let i = 0; i < shotCount; i++) {
            setTimeout(() => {
                if (typeof consumeArrow === "function") consumeArrow();
                const curCenterX = player.x + player.width / 2;
                const curCenterY = player.y + player.height / 2;

                projectiles.push({
                    type: "arrow",
                    x: curCenterX + Math.cos(baseAngle) * 20,
                    y: curCenterY + Math.sin(baseAngle) * 20,
                    vx: Math.cos(baseAngle) * arrowSpeed,
                    vy: Math.sin(baseAngle) * arrowSpeed,
                    angle: baseAngle,
                    traveled: 0,
                    maxDist: maxDist,
                    damage: arrowDmg,
                    isHoming: hasHoming,
                    isPickable: true // 필드 회수 가능
                });

                if (hasSplit) {
                    [-0.22, 0.22].forEach(spread => {
                        const spAngle = baseAngle + spread;
                        projectiles.push({
                            type: "arrow",
                            x: curCenterX + Math.cos(spAngle) * 20,
                            y: curCenterY + Math.sin(spAngle) * 20,
                            vx: Math.cos(spAngle) * arrowSpeed,
                            vy: Math.sin(spAngle) * arrowSpeed,
                            angle: spAngle,
                            traveled: 0,
                            maxDist: maxDist,
                            damage: Math.floor(arrowDmg * 0.85),
                            isHoming: hasHoming,
                            isPickable: false // 분열 복제 화살은 회수 불가
                        });
                    });
                }

                if (typeof addVisualEffect === "function") {
                    addVisualEffect(curCenterX, curCenterY, 20, "#00FF66");
                }
            }, i * 90);
        }

        addFloatingText(player.x, player.y - 30, "속공(RAPID SHOT)!", "#00FF66");
        player.aimingSkill = null;
        return true;
    }
    return false;
}

// [MOD-015-4: 타격 및 경험치/레벨업 로직]
function applyDamageToGoblin(dmg, targetGob) {
    let gob = targetGob || (MAP_DATA.dungeon && Array.isArray(MAP_DATA.dungeon.goblins) && MAP_DATA.dungeon.goblins.length > 0 ? MAP_DATA.dungeon.goblins[0] : MAP_DATA.dungeon.goblin);
    if (!gob || !gob.active) return;

    gob.hp -= dmg;
    addFloatingText(gob.x, gob.y - gob.size, dmg, "orange"); // 딜 캐치 텍스트
    
    // 고블린 체력 소진 시 미로 통로 랜덤 위치에 리스폰 및 경험치 처리
    if (gob.hp <= 0) {
        gob.hp = gob.maxHp;
        
        // 미로 스폰 포인트 목록에서 랜덤 선택
        if (typeof GOBLIN_SPAWN_POINTS !== "undefined" && GOBLIN_SPAWN_POINTS.length > 0) {
            const randPt = GOBLIN_SPAWN_POINTS[Math.floor(Math.random() * GOBLIN_SPAWN_POINTS.length)];
            gob.x = randPt.x + (Math.random() * 40 - 20);
            gob.y = randPt.y + (Math.random() * 40 - 20);
        } else {
            gob.x = Math.random() * 800 + 1100;
            gob.y = Math.random() * 800 + 1100;
        }
        
        if (player.lockedTarget === gob) {
            player.lockedTarget = null; // 죽었으므로 락온 해제
        }

        player.exp += gob.expReward;
        // 경험치 임계치 도달 시 레벨업 및 상태 풀 회복
        if (player.exp >= player.maxExp) {
            player.level++;
            player.exp -= player.maxExp;
            player.maxExp = Math.floor(player.maxExp * 1.5); // 다음 요구 경험치 1.5배 증가
            player.currentHp = player.maxHp;
            player.currentStamina = player.maxStamina;
            player.currentMana = player.maxMana;
            addFloatingText(player.x, player.y - 30, "LEVEL UP!", "gold");
        }
    }
}

setTimeout(() => {
    updateQuickSlotUI();
    if (typeof updateArrowCountUI === "function") updateArrowCountUI();
}, 100); // 로드 시 UI 강제 갱신
// [MOD-015-END]
