// [PROGRESSION: 플레이어 성장, 스탯, 전직 및 스킬 덱 빌딩 시스템]

// [MOD-014: 캐릭터 생성(스탯 분배 및 직업 선택) 로직]
// [MOD-014-1: 육각형 레이더 차트 렌더링 (폭 150px 비율 초압축 최적화)]
function drawRadarChart(canvasId) {
    const rc = document.getElementById(canvasId);
    if (!rc) return;
    const rctx = rc.getContext("2d");
    
    const w = rc.width;
    const h = rc.height;
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2); 
    
    let maxR = 0;
    let fontSize = 12;
    let textOffset = 35;
    
    let labelsContainer = document.getElementById(canvasId + "_labels");
    if (labelsContainer) labelsContainer.innerHTML = "";
    
    if (canvasId === "infoRadarCanvas") {
        maxR = 52; 
        fontSize = 10;
        textOffset = 18; 
    } else {
        maxR = (Math.min(w, h) / 2) - 35;
    }

    rctx.clearRect(0, 0, w, h);

    const labels = ["체력", "힘", "민첩", "마나", "지구력", "매력"];
    const statKeys = ["hp", "str", "dex", "mana", "stamina", "charm"];
    const total = 6;
    const angleStep = (Math.PI * 2) / total;

    // 1. 방사형 가이드라인 (동심원 4단계)
    rctx.strokeStyle = "#444";
    rctx.lineWidth = 1;
    for (let level = 1; level <= 4; level++) {
        const r = (maxR / 4) * level;
        rctx.beginPath();
        for (let i = 0; i < total; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) rctx.moveTo(x, y);
            else rctx.lineTo(x, y);
        }
        rctx.closePath();
        rctx.stroke();
    }

    // 2. 축 선 그리기 및 HTML 라벨 배치
    rctx.strokeStyle = "#555";
    for (let i = 0; i < total; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + maxR * Math.cos(angle);
        const y = cy + maxR * Math.sin(angle);
        rctx.beginPath();
        rctx.moveTo(cx, cy);
        rctx.lineTo(x, y);
        rctx.stroke();

        let lx = cx + (maxR + textOffset) * Math.cos(angle);
        let ly = cy + (maxR + textOffset) * Math.sin(angle);

        if (canvasId === "infoRadarCanvas") {
            if (labelsContainer) {
                const span = document.createElement("span");
                span.innerText = labels[i];
                span.style.position = "absolute";
                span.style.fontSize = "10px";
                span.style.fontWeight = "bold";
                span.style.color = "#ccc";
                span.style.pointerEvents = "none";
                span.style.whiteSpace = "nowrap";

                let alignX = "-50%";
                let alignY = "-50%";

                if (i === 0) { ly += 6; }
                else if (i === 1) { alignX = "-100%"; lx -= 2; }
                else if (i === 2) { alignX = "-100%"; lx -= 2; }
                else if (i === 3) { ly -= 6; }
                else if (i === 4) { alignX = "0%"; lx += 2; }
                else if (i === 5) { alignX = "0%"; lx += 2; }

                span.style.left = `${lx}px`;
                span.style.top = `${ly}px`;
                span.style.transform = `translate(${alignX}, ${alignY})`;
                labelsContainer.appendChild(span);
            }
        } else {
            rctx.fillStyle = "#aaa";
            rctx.font = `${fontSize}px sans-serif`;
            rctx.textAlign = "center";
            rctx.textBaseline = "middle";
            rctx.fillText(labels[i], lx, ly);
        }
    }

    // 3. 실제 스탯 다각형 그리기
    const currentStats = player.stats;
    const maxStatValue = 20;

    rctx.fillStyle = "rgba(0, 255, 204, 0.4)";
    rctx.strokeStyle = "#00ffcc";
    rctx.lineWidth = 2;

    rctx.beginPath();
    for (let i = 0; i < total; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const val = currentStats[statKeys[i]] || 3;
        const ratio = Math.min(val / maxStatValue, 1.0);
        const r = maxR * Math.max(ratio, 0.1);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);

        if (i === 0) rctx.moveTo(x, y);
        else rctx.lineTo(x, y);
    }
    rctx.closePath();
    rctx.fill();
    rctx.stroke();
}
// [MOD-014-1-END]

// [MOD-014-2: 스탯 증감 및 UI 업데이트]
function adjustStat(stat, amount) {
    if (amount > 0 && totalFreePoints > 0) {
        player.stats[stat] += 1;
        totalFreePoints -= 1;
    } else if (amount < 0 && player.stats[stat] > 3) {
        player.stats[stat] -= 1;
        totalFreePoints += 1;
    }
    updateCharCreationUI();
}

function updateCharCreationUI() {
    document.getElementById("ccFreePoints").innerText = totalFreePoints;
    statKeys.forEach(k => {
        const el = document.getElementById(`st_${k}`);
        if (el) el.innerText = player.stats[k];
    });
    drawRadarChart("ccRadarCanvas");
    renderClassList();
    checkStartBtn();
}

// [MOD-014-3: 직업 요구사항 확인 및 토글]
function toggleJob(job) {
    let canPick = true;
    if (job.req) {
        job.req.forEach(r => {
            if (player.stats[r] < job.reqVal) canPick = false;
        });
    }

    if (!canPick) {
        alert("스탯 요구조건을 충족하지 못했습니다!");
        return;
    }

    if (job.type === "basic") {
        tempSelectedJobs = tempSelectedJobs.filter(j => j.type !== "basic");
        tempSelectedJobs.push(job);
    } else {
        const idx = tempSelectedJobs.findIndex(j => j.name === job.name);
        if (idx >= 0) {
            tempSelectedJobs.splice(idx, 1);
        } else {
            if (tempSelectedJobs.filter(j => j.type === "special").length >= 2) {
                alert("특수 직업은 최대 2개까지만 선택 가능합니다!");
                return;
            }
            tempSelectedJobs.push(job);
        }
    }
    renderClassList();
    checkStartBtn();
}

function checkStartBtn() {
    const btn = document.getElementById("ccStartBtn");
    const hasBasic = tempSelectedJobs.some(j => j.type === "basic");
    if (totalFreePoints === 0 && hasBasic) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

function renderClassList() {
    const list = document.getElementById("ccClassList");
    if (!list) return;
    list.innerHTML = "";

    if (typeof JOB_DATA !== "undefined") {
        JOB_DATA.forEach(job => {
            let locked = false;
            if (job.req) {
                job.req.forEach(r => {
                    if (player.stats[r] < job.reqVal) locked = true;
                });
            }

            const isSelected = tempSelectedJobs.some(j => j.name === job.name);
            const div = document.createElement("div");
            div.className = `class-item ${locked ? "locked" : ""} ${isSelected ? "selected" : ""}`;
            
            let normalDesc = job.normal ? `<br><small style="color:#aaa;">기본: ${job.normal.desc}</small>` : '';
            let skillDesc = job.skill ? `<br><small style="color:#00ffcc;">스킬: ${job.skill.desc}</small>` : '';
            
            div.innerHTML = `<div>${job.name} <small>(${job.desc})</small>${normalDesc}${skillDesc}</div>`;
            div.onclick = () => toggleJob(job);
            list.appendChild(div);
        });
    }
}

// [MOD-014-4: 스탯 최종 반영]
function finishGuildJoin() {
    const nameInput = document.getElementById("ccPlayerName");
    if (nameInput && nameInput.value.trim() !== "") {
        player.name = nameInput.value.trim();
    }
    
    player.baseStats = { ...player.stats };
    player.acquiredJobs = [...tempSelectedJobs];
    
    const basicJob = player.acquiredJobs.find(j => j.type === "basic");
    player.job = basicJob ? basicJob.name : "견습 기사";
    player.currentSkillIdx = 0;
    player.aimingSkill = null;

    player.maxHp = player.stats.hp * 3;
    player.currentHp = player.maxHp;
    player.maxStamina = player.stats.stamina * 3;
    player.currentStamina = player.maxStamina;
    player.maxMana = player.stats.mana * 3;
    player.currentMana = player.maxMana;

    gameState = "playing"; // 게임 상태 복귀
    document.getElementById("charCreationUI").style.display = "none";
}
// [MOD-014-END]

// [스탯 합산 계산 함수]
function updatePlayerTotalStats() {
    let totalStats = { ...player.baseStats };

    if (player.equipment) {
        for (let slotKey in player.equipment) {
            let item = player.equipment[slotKey];
            if (!item) continue;
            let baseItem = ITEM_DB[item.baseId];
            if (!baseItem) continue;

            if (baseItem.stats) {
                for (let s in baseItem.stats) {
                    totalStats[s] = (totalStats[s] || 0) + baseItem.stats[s];
                }
            }

            if (item.sockets) {
                item.sockets.forEach(sock => {
                    if (!sock) return;
                    let baseId = typeof sock === "string" ? sock : sock.baseId;
                    let level = (typeof sock === "object" && sock.level) ? sock.level : 1;
                    if (baseId && ITEM_DB[baseId] && ITEM_DB[baseId].enchantEffect) {
                        let enchData = ITEM_DB[baseId].enchantEffect;
                        totalStats[enchData.stat] = (totalStats[enchData.stat] || 0) + (enchData.value * level);
                    }
                });
            }
        }
    }

    player.stats = totalStats;

    player.maxHp = player.stats.hp * 3;
    player.currentHp = Math.min(player.currentHp, player.maxHp);
    player.maxStamina = player.stats.stamina * 3;
    player.currentStamina = Math.min(player.currentStamina, player.maxStamina);
    player.maxMana = player.stats.mana * 3;
    player.currentMana = Math.min(player.currentMana, player.maxMana);

    drawRadarChart("infoRadarCanvas");
}

// (useSkillBook은 inventory.js에 통합 관리됩니다)

// [MOD-025: 스킬 덱 드래그 앤 드롭 세팅 로직]
let dragSkillState = { active: false, skillObj: null, ghostEl: null, sourceIdx: -1 };

function renderSkillUI() {
    const list = document.getElementById("skillListContainer");
    if (!list) return;
    list.innerHTML = "";
    
    let equippedIds = player.quickSlots.filter(s => s !== null).map(s => s.id);
    
    // 1. 보유 스킬 리스트업
    player.unlockedSkills.forEach(skillId => {
        let skill = MOCK_SKILLS[skillId];
        if (!skill) return;
        
        if (equippedIds.includes(skill.id)) return; 

        let div = document.createElement("div");
        div.className = "skill-icon";
        div.style.position = "relative"; 
        div.innerText = skill.name;
        
        if (player.newlyAcquiredSkills.includes(skill.id)) {
            let badge = document.createElement("div");
            badge.className = "noti-badge";
            badge.innerText = "!";
            badge.style.top = "-6px";
            badge.style.right = "-6px";
            badge.style.width = "14px";
            badge.style.height = "14px";
            badge.style.fontSize = "10px";
            div.appendChild(badge);
        }

        const clearBadge = () => {
            let idx = player.newlyAcquiredSkills.indexOf(skill.id);
            if (idx > -1) {
                player.newlyAcquiredSkills.splice(idx, 1);
                let b = div.querySelector('.noti-badge');
                if (b) b.remove();
            }
        };
        
        div.addEventListener("mouseenter", clearBadge);
        div.addEventListener("touchstart", clearBadge, { passive: true });

        div.onmousedown = (e) => { clearBadge(); startSkillDrag(e, skill, -1); };
        div.ontouchstart = (e) => { clearBadge(); startSkillDrag(e, skill, -1); };
        
        list.appendChild(div);
    });

    // 2. 5칸 스킬 덱 슬롯 렌더링
    for (let i = 0; i < 5; i++) {
        let slot = document.getElementById("deck-slot-" + i);
        if (!slot) continue;
        slot.innerHTML = "";
        
        let skill = player.quickSlots[i];
        if (skill) {
            let div = document.createElement("div");
            div.className = "skill-icon";
            div.style.width = "100%";
            div.style.height = "100%";
            div.style.border = "none";
            div.innerText = skill.name;
            
            div.onmousedown = (e) => startSkillDrag(e, skill, i);
            div.ontouchstart = (e) => startSkillDrag(e, skill, i);
            
            slot.appendChild(div);
        }
    }
}

function startSkillDrag(e, skillObj, sourceIdx) {
    if (dragSkillState.active) return;
    dragSkillState.active = true;
    dragSkillState.skillObj = skillObj;
    dragSkillState.sourceIdx = sourceIdx;

    let ghost = document.createElement("div");
    ghost.className = "skill-icon skill-ghost";
    ghost.innerText = skillObj.name;
    document.body.appendChild(ghost);
    dragSkillState.ghostEl = ghost;

    moveSkillGhost(e);

    document.addEventListener("mousemove", moveSkillGhost);
    document.addEventListener("touchmove", moveSkillGhost, { passive: false });
    document.addEventListener("mouseup", endSkillDrag);
    document.addEventListener("touchend", endSkillDrag);
}

function moveSkillGhost(e) {
    if (!dragSkillState.active || !dragSkillState.ghostEl) return;
    let clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    let clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    
    dragSkillState.ghostEl.style.left = clientX + "px";
    dragSkillState.ghostEl.style.top = clientY + "px";

    for (let i = 0; i < 5; i++) {
        let slot = document.getElementById("deck-slot-" + i);
        if (!slot) continue;
        let rect = slot.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            slot.classList.add("highlight");
        } else {
            slot.classList.remove("highlight");
        }
    }
}

function endSkillDrag(e) {
    if (!dragSkillState.active) return;

    document.removeEventListener("mousemove", moveSkillGhost);
    document.removeEventListener("touchmove", moveSkillGhost);
    document.removeEventListener("mouseup", endSkillDrag);
    document.removeEventListener("touchend", endSkillDrag);

    let clientX = e.type.includes("touch") ? (e.changedTouches[0] ? e.changedTouches[0].clientX : 0) : e.clientX;
    let clientY = e.type.includes("touch") ? (e.changedTouches[0] ? e.changedTouches[0].clientY : 0) : e.clientY;

    let droppedOnSlot = false;

    for (let i = 0; i < 5; i++) {
        let slot = document.getElementById("deck-slot-" + i);
        if (!slot) continue;
        slot.classList.remove("highlight");
        
        let rect = slot.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            if (dragSkillState.sourceIdx !== -1) {
                let temp = player.quickSlots[i];
                player.quickSlots[i] = dragSkillState.skillObj;
                player.quickSlots[dragSkillState.sourceIdx] = temp;
            } else {
                player.quickSlots[i] = dragSkillState.skillObj;
            }
            droppedOnSlot = true;
        }
    }

    if (!droppedOnSlot && dragSkillState.sourceIdx !== -1) {
        player.quickSlots[dragSkillState.sourceIdx] = null;
    }

    dragSkillState.ghostEl.remove();
    dragSkillState.active = false;
    
    renderSkillUI();
    if (typeof updateQuickSlotUI === "function") updateQuickSlotUI();
}
// [MOD-025-END]
