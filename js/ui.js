// [UI: 인트로, 로비, HUD/툴팁, 탭 전환 및 시스템 메뉴]

// [MOD-013: 인트로, 로그인 및 임시 로비 파이프라인 (기존 캐릭터 생성 완벽 대체)]

// 1. 기존의 쓸모없어진 캐릭터 생성 UI는 DOM에서 영구 삭제합니다 (HTML 건드릴 필요 없음)
const oldCharUI = document.getElementById("charCreationUI");
if (oldCharUI) oldCharUI.remove();

// 2. 파이프라인 첫 단계 상태 설정
gameState = "title";

// 3. 폰트 및 공통 스타일 주입
const introStyle = document.createElement("style");
introStyle.innerHTML = `
            .intro-screen { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: black; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 5000; transition: opacity 0.5s ease; user-select: none; }
            .hidden-screen { opacity: 0; pointer-events: none; }
            .lobby-btn { background: #333; color: white; border: 2px solid #555; padding: 10px 20px; font-weight: bold; cursor: pointer; border-radius: 6px; transition: 0.2s; }
            .lobby-btn:hover { background: #555; border-color: gold; }
            .lobby-btn.selected { background: #555; border-color: gold; color: gold; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
            .lobby-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .login-input { padding: 12px; font-size: 16px; border-radius: 6px; border: 2px solid #555; background: #222; color: white; outline: none; text-align: center; font-weight: bold; transition: 0.3s; }
            .login-input:focus { border-color: gold; }
        `;
document.head.appendChild(introStyle);

// [1단계: 타이틀 화면]
const titleScreen = document.createElement("div");
titleScreen.className = "intro-screen";
titleScreen.innerHTML = `
            <div style="position: absolute; top: 20px; right: 24px; font-size: 14px; color: #aaa; font-family: 'Consolas', 'Courier New', monospace; letter-spacing: 1px; background: rgba(255, 255, 255, 0.08); padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); pointer-events: none; z-index: 5001;">v0.2.7.1015.5</div>
            <div style="font-size: 48px; font-weight: bold; letter-spacing: 5px; cursor: pointer; text-shadow: 0 0 20px rgba(255,255,255,0.5);">Under To Under</div>
            <div style="margin-top: 30px; font-size: 14px; color: #888; animation: pulse-noti 1.5s infinite;">화면을 클릭하여 시작하세요</div>
        `;
document.body.appendChild(titleScreen);

// [2단계: 로그인 및 닉네임 화면]
const loginScreen = document.createElement("div");
loginScreen.className = "intro-screen hidden-screen";
loginScreen.innerHTML = `
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; color: gold;">접속자 정보 설정</div>
            <input type="text" id="loginNameInput" class="login-input" placeholder="사용할 닉네임 입력" maxlength="10">
            <button class="lobby-btn" style="margin-top: 20px; font-size: 16px;" onclick="submitLogin()">접속하기</button>
            <div id="loginErrorMsg" style="color: #ff4444; font-size: 12px; margin-top: 10px; opacity: 0; transition: 0.3s;">이름을 입력해주세요.</div>
        `;
document.body.appendChild(loginScreen);

// [3단계: 인트로 시네마틱 (개발중)]
const animScreen = document.createElement("div");
animScreen.className = "intro-screen hidden-screen";
animScreen.innerHTML = `
            <div style="font-size: 32px; font-weight: bold; color: #aaa; letter-spacing: 10px;">개발중</div>
            <div id="animSkipMsg" style="margin-top: 40px; font-size: 12px; color: #666;">(클릭하여 스킵)</div>
        `;
document.body.appendChild(animScreen);

// [4단계: 임시 로비 화면]
const lobbyScreen = document.createElement("div");
lobbyScreen.className = "intro-screen hidden-screen";
lobbyScreen.style.backgroundColor = "#111"; // 추후 배경 이미지 삽입 가능
lobbyScreen.innerHTML = `
            <div style="position: absolute; top: 20px; right: 24px; font-size: 14px; color: #aaa; font-family: 'Consolas', 'Courier New', monospace; letter-spacing: 1px; background: rgba(255, 255, 255, 0.08); padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); pointer-events: none; z-index: 5001;">v0.2.7.1015.5</div>
            <div style="background: rgba(20,20,25,0.95); border: 2px solid #444; border-radius: 10px; padding: 30px; width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 20px; text-align: center;">
                <div id="lobbyWelcomeMsg" style="color: white; font-size: 18px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 15px;">환영합니다, 플레이어님</div>
                
                <div style="text-align: left;">
                    <div style="color: gold; font-size: 13px; font-weight: bold; margin-bottom: 10px;">모드 선택</div>
                    <div style="display: flex; gap: 10px;">
                        <button class="lobby-btn selected" style="flex: 1;">🌐 멀티플레이</button>
                        <button class="lobby-btn" style="flex: 1;" disabled title="추후 업데이트 예정">📖 스토리 모드</button>
                    </div>
                </div>

                <div style="text-align: left;">
                    <div style="color: gold; font-size: 13px; font-weight: bold; margin-bottom: 10px;">시작 무기 선택 (직업 결정)</div>
                    <div style="display: flex; gap: 8px; justify-content: space-between;">
                        <button id="wpn_sword" class="lobby-btn selected" style="flex: 1; padding: 10px 4px; font-size: 11px;" onclick="selectLobbyWeapon('sword')">⚔️ 기본 검<br><span style="font-size:9px; color:#aaa;">밸런스형</span></button>
                        <button id="wpn_axe" class="lobby-btn" style="flex: 1; padding: 10px 4px; font-size: 11px;" onclick="selectLobbyWeapon('axe')">🪓 ㄱ자 도끼<br><span style="font-size:9px; color:#aaa;">힘 특화</span></button>
                        <button id="wpn_wand" class="lobby-btn" style="flex: 1; padding: 10px 4px; font-size: 11px;" onclick="selectLobbyWeapon('wand')">🪄 지팡이<br><span style="font-size:9px; color:#aaa;">마나 특화</span></button>
                        <button id="wpn_bow" class="lobby-btn" style="flex: 1; padding: 10px 4px; font-size: 11px;" onclick="selectLobbyWeapon('bow')">🏹 활<br><span style="font-size:9px; color:#aaa;">원거리</span></button>
                    </div>
                </div>

                <button class="lobby-btn" style="margin-top: 15px; background: #225522; border-color: #44aa44; font-size: 18px; padding: 15px;" onclick="enterWorld()">월드 입장</button>
            </div>
        `;
document.body.appendChild(lobbyScreen);

// --- 파이프라인 제어 로직 ---
let selectedLobbyWeapon = 'sword';
let introAnimTimer = null;
let canSkipIntro = false;

// [로직 1] 타이틀 -> 로그인
titleScreen.addEventListener("click", () => {
    if (gameState !== "title") return;
    gameState = "login";
    titleScreen.classList.add("hidden-screen");
    loginScreen.classList.remove("hidden-screen");
    setTimeout(() => { document.getElementById("loginNameInput").focus(); }, 100);
});

// [로직 2] 로그인 -> 인트로
window.submitLogin = function () {
    const nameInput = document.getElementById("loginNameInput").value.trim();
    if (!nameInput) {
        document.getElementById("loginErrorMsg").style.opacity = "1";
        return;
    }
    // HTML 특수문자 이스케이프 (XSS 태그 삽입 완벽 방지)
    const sanitizedName = nameInput.replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
    player.name = sanitizedName;
    const welcomeMsg = document.getElementById("lobbyWelcomeMsg");
    if (welcomeMsg) {
        welcomeMsg.innerHTML = `환영합니다, <span style="color:gold;">${sanitizedName}</span> 님`;
    }

    gameState = "intro";
    loginScreen.classList.add("hidden-screen");
    animScreen.classList.remove("hidden-screen");

    // 방문 기록(쿠키/스토리지) 확인
    const hasVisited = localStorage.getItem("utu_visited");
    const skipMsg = document.getElementById("animSkipMsg");

    if (hasVisited) {
        // 재방문: 터치 즉시 스킵 가능
        canSkipIntro = true;
        skipMsg.innerText = "(화면을 터치하여 즉시 스킵)";
    } else {
        // 첫 방문: 3초간 강제 대기
        canSkipIntro = false;
        skipMsg.innerText = "(첫 접속 - 애니메이션 재생 중...)";
        localStorage.setItem("utu_visited", "true"); // 방문 도장 쾅!

        setTimeout(() => {
            canSkipIntro = true;
            skipMsg.innerText = "(아무 곳이나 터치하여 스킵)";
            introAnimTimer = setTimeout(skipIntroToLobby, 3000); // 안 누르면 3초 뒤 자동 진행
        }, 3000);
    }
};

// [로직 3] 인트로 -> 로비 진입
animScreen.addEventListener("click", () => {
    if (gameState === "intro" && canSkipIntro) skipIntroToLobby();
});

function skipIntroToLobby() {
    clearTimeout(introAnimTimer);
    gameState = "lobby";
    animScreen.classList.add("hidden-screen");
    lobbyScreen.classList.remove("hidden-screen");
}

// [로직 4] 무기 선택(직업) 라디오 버튼 스위칭
window.selectLobbyWeapon = function (type) {
    selectedLobbyWeapon = type;
    const btnSword = document.getElementById("wpn_sword");
    const btnAxe = document.getElementById("wpn_axe");
    const btnWand = document.getElementById("wpn_wand");
    const btnBow = document.getElementById("wpn_bow");
    if (btnSword) btnSword.classList.remove("selected");
    if (btnAxe) btnAxe.classList.remove("selected");
    if (btnWand) btnWand.classList.remove("selected");
    if (btnBow) btnBow.classList.remove("selected");
    const targetBtn = document.getElementById("wpn_" + type);
    if (targetBtn) targetBtn.classList.add("selected");
};

// [로직 5] 로비 -> 게임 월드 진짜 입장!
window.enterWorld = function () {
    // [버그 수정 1] 오류를 뿜던 지팡이 주입 로직을 DB가 만들어진 이후인 이곳으로 이동시켰습니다!
    if (!ITEM_DB["wand_basic"]) {
        ITEM_DB["wand_basic"] = {
            name: "초보자 지팡이", type: "equip", equipSlot: "mainWeapon", color: "#8B4513",
            shape: [[1], [1], [1]], stats: { str: 0, mana: 8 }, maxSockets: 2,
            desc: "마력을 집중하기 좋은 튼튼한 나무 지팡이."
        };
    }

    gameState = "playing";
    lobbyScreen.classList.add("hidden-screen");

    // 화면 완전 삭제 (가려진 UI 메모리 해제)
    setTimeout(() => {
        titleScreen.remove(); loginScreen.remove(); animScreen.remove(); lobbyScreen.remove();
    }, 500);

    // 초기 장비 셋업 (가방을 거치지 않고 내 손에 즉시 장착)
    player.equipment.mainWeapon = null;

    // [버그 수정 2] 최신 ITEM_DB의 영문 ID 규격으로 올바르게 매칭
    let startWeaponId = "sword_basic"; // 기본 검
    if (selectedLobbyWeapon === "axe") startWeaponId = "axe_battle"; // ㄱ자 도끼
    if (selectedLobbyWeapon === "wand") startWeaponId = "wand_basic"; // 지팡이
    if (selectedLobbyWeapon === "bow") {
        startWeaponId = "bow_basic"; // 활
        // 활 선택 시 기본 소지품으로 화살 64개 묶음 1개 지급
        if (typeof myInventoryItems !== "undefined") {
            myInventoryItems.push({
                id: "start_arrow_1",
                baseId: "arrow",
                count: 64,
                container: "main",
                gridX: 0,
                gridY: 0,
                rot: 0
            });
        }
        // 활 선택 시 속공(rapid_shot) 스킬 해금 및 퀵슬롯 2번에 배치
        if (player.unlockedSkills && !player.unlockedSkills.includes("rapid_shot")) {
            player.unlockedSkills.push("rapid_shot");
        }
        if (typeof MOCK_SKILLS !== "undefined" && MOCK_SKILLS.rapid_shot && player.quickSlots) {
            player.quickSlots[1] = MOCK_SKILLS.rapid_shot;
        }
    }

    let startWpn = {
        id: "start_wpn_1",
        baseId: startWeaponId,
        gridX: -1, gridY: -1, rot: 0,
        sockets: Array(ITEM_DB[startWeaponId].maxSockets || 0).fill(null)
    };

    // 무기 쥐어주기 (이것이 곧 스탯이자 직업!)
    player.equipment.mainWeapon = startWpn;

    // [사용자 요청: 모든 아이템은 창고로 이동, 가방에는 겹치는 포션 추가하지 않음]

    // UI 및 스탯 최종 갱신
    updatePlayerTotalStats();
    if (typeof updateQuickSlotUI === "function") updateQuickSlotUI();

    // 장비가 올려준 스탯(최대 체력/마나 등)에 맞게 현재 풀피로 꽉 채워줌
    player.currentHp = player.maxHp;
    player.currentMana = player.maxMana;
    player.currentStamina = player.maxStamina;

    renderEquipSlotsUI();

    // 모바일일 경우 가상 패드 컨트롤러 노출
    const vpad = document.getElementById("vpad-container");
    if (vpad) vpad.style.display = "block";
};
// [MOD-013-END]

// [MOD-017: 알림 뱃지 및 인벤토리 뷰 전환]
function updateNotiBadges() {
    document.querySelectorAll('.noti-badge:not(.socket-badge)').forEach(e => e.remove());

    let allScrolls = (typeof getAvailableEnchantScrolls === "function")
        ? getAvailableEnchantScrolls()
        : [...myInventoryItems, ...(gameState === "storage" ? personalStorage : [])];

    let hasScroll = allScrolls.some(i => ITEM_DB[i.baseId] && ITEM_DB[i.baseId].type === "enchant");
    if (!hasScroll) return;

    let enchantableSlots = [];
    for (let slotKey in player.equipment) {
        let item = player.equipment[slotKey];
        if (!item || !item.sockets) continue;

        let equippedEnchants = item.sockets.filter(s => s !== null).map(s => typeof s === "string" ? s : s.baseId);
        let hasNewScroll = allScrolls.some(i => ITEM_DB[i.baseId] && ITEM_DB[i.baseId].type === "enchant" && !equippedEnchants.includes(i.baseId));
        let hasEmptySocket = item.sockets.some(s => s === null) && hasNewScroll;
        let hasUpgradableSocket = item.sockets.some(s => {
            if (!s) return false;
            let baseId = typeof s === "string" ? s : s.baseId;
            return allScrolls.some(sc => sc.baseId === baseId);
        });

        if (hasEmptySocket || hasUpgradableSocket) {
            enchantableSlots.push(slotKey);
        }
    }
    if (enchantableSlots.length === 0) return;

    if (currentRightView === 'inventory') {
        let btn = document.getElementById("modeSwitchBtn");
        if (btn) {
            let badge = document.createElement("div");
            badge.className = "noti-badge";
            badge.innerText = "!";
            btn.appendChild(badge);
        }
    } else if (currentRightView === 'enchant') {
        enchantableSlots.forEach(slotKey => {
            if (currentEnchantTargetSlot !== slotKey) {
                let slotEl = document.querySelector(`.slot-${slotKey}, [data-slot="${slotKey}"]`);
                if (slotEl) {
                    let badge = document.createElement("div");
                    badge.className = "noti-badge";
                    badge.innerText = "!";
                    slotEl.appendChild(badge);
                }
            }
        });
    }
}

// [renderEquipSlotsUI, updatePlayerTotalStats는 js/inventory.js 및 js/progression.js로 분리되었습니다.]
function toggleRightPanelView() {
    const btn = document.getElementById("modeSwitchBtn");
    const viewInv = document.getElementById("viewInventory");
    const viewEnc = document.getElementById("viewEnchant");

    if (currentRightView === 'inventory') {
        currentRightView = 'enchant';
        viewInv.style.display = 'none'; viewEnc.style.display = 'flex';
        btn.innerHTML = '&laquo;';
        if (typeof renderSkillUI === 'function') renderSkillUI();
    } else {
        currentRightView = 'inventory';
        viewInv.style.display = 'block'; viewEnc.style.display = 'none';
        btn.innerHTML = '&raquo;';
        document.getElementById('enchantPopupUI').style.display = 'none';

        clearEnchantRegistration();
        if (typeof renderGridInventory === "function") renderGridInventory();
    }
    updateNotiBadges();
    autoScaleInventory();
}

// [인챈트 팝업 및 처리 로직은 js/inventory.js로 분리되었습니다.]
function closeUI() {
    gameState = "playing";
    document.getElementById("inventoryUI").style.display = "none";

    let sp = document.getElementById("storagePanel");
    if (sp) sp.style.display = "none";

    clearEnchantRegistration();

    if (currentRightView === 'enchant') toggleRightPanelView();
    const vpad = document.getElementById("vpad-container");
    if (vpad) vpad.style.display = "block";
    updateNotiBadges();
}

// [인벤토리 외부 배경 클릭/터치 시 닫기 핸들러]
(function initInventoryBackdropClose() {
    function setupBackdropListener() {
        const invUI = document.getElementById("inventoryUI");
        if (!invUI) return;

        let isBackdropClick = false;
        invUI.addEventListener("mousedown", (e) => {
            isBackdropClick = (e.target === invUI);
        });

        invUI.addEventListener("mouseup", (e) => {
            if (isBackdropClick && e.target === invUI) {
                if (typeof dragItemState === "undefined" || !dragItemState.active) {
                    closeUI();
                }
            }
            isBackdropClick = false;
        });

        let isBackdropTouch = false;
        invUI.addEventListener("touchstart", (e) => {
            isBackdropTouch = (e.target === invUI);
        }, { passive: true });

        invUI.addEventListener("touchend", (e) => {
            if (isBackdropTouch && e.target === invUI) {
                if (typeof dragItemState === "undefined" || !dragItemState.active) {
                    closeUI();
                }
            }
            isBackdropTouch = false;
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupBackdropListener);
    } else {
        setupBackdropListener();
    }
})();

function autoScaleInventory() {
    const container = document.querySelector('.inv-container');
    if (!container) return;

    // [버그수정] 창고가 열려있을 때만 860, 일반 가방 및 [>>>] 인챈트 화면에서는 520으로 고정하여 창 크기 유지
    let baseW = (gameState === 'storage') ? 860 : 520;
    const baseH = 450;

    const scaleX = (window.innerWidth * 0.9) / baseW;
    const scaleY = (window.innerHeight * 0.9) / baseH;
    let scale = Math.min(scaleX, scaleY);
    scale = Math.max(0.5, Math.min(scale, 1.8));

    container.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', autoScaleInventory);

function switchTab(tabId) {
    try {
        if (typeof renderEquipSlotsUI === "function") renderEquipSlotsUI();
        if (typeof renderGridInventory === "function") renderGridInventory();
        if (typeof updatePlayerTotalStats === "function") updatePlayerTotalStats();
    } catch (err) {
        console.error("switchTab render error:", err);
    } finally {
        if (typeof autoScaleInventory === "function") autoScaleInventory();
    }
}
// [MOD-017-1-END]

// [MOD-017-2: AABB 2D 사각형 충돌 계산 유틸리티는 js/world.js로 분리되었습니다.]

// [MOD-018: 메인 게임 루프 (60프레임 반복 렌더링)]

// [MOD-020: 아이템 정보 툴팁 표시]
function showTooltip(e, itemObj) {
    if (dragItemState.active) return;
    const baseItem = ITEM_DB[itemObj.baseId];
    if (!baseItem) return;

    let titleHtml = baseItem.name;
    let typeKor = baseItem.type === "equip" ? `[장비 - ${baseItem.equipSlot}]` : (baseItem.type === "enchant" ? "[인챈트 두루마리]" : `[${baseItem.type}]`);

    let statHtml = "";
    if (baseItem.stats) {
        for (let k in baseItem.stats) statHtml += `<div>${k}: +${baseItem.stats[k]}</div>`;
    }

    let enchantHtml = "";
    if (itemObj.sockets) {
        let enchants = itemObj.sockets.filter(s => s !== null);
        if (enchants.length > 0) {
            enchantHtml = "<div class='item-tooltip-enchant-title'>[인챈트 목록]</div>";
            enchants.forEach(sock => {
                let baseId = typeof sock === "string" ? sock : sock.baseId;
                let level = (typeof sock === "object" && sock.level) ? sock.level : 1;
                if (ITEM_DB[baseId] && ITEM_DB[baseId].enchantEffect) {
                    let effect = ITEM_DB[baseId].enchantEffect;
                    let totalVal = effect.value * level;
                    enchantHtml += `<div class='item-tooltip-enchant-item'>- 강타+${level} (${effect.stat}+${totalVal})</div>`;
                }
            });
        }
    }

    let descHtml = baseItem.desc || "테스트용 아이템이다.";

    tooltipEl.innerHTML = `
                <div class="item-tooltip-title">${titleHtml}</div>
                <div class="item-tooltip-type">${typeKor}</div>
                <div class="item-tooltip-stat">${statHtml}</div>
                ${enchantHtml}
                <div class="item-tooltip-desc">${descHtml}</div>
            `;

    tooltipEl.style.display = "block";
    tooltipVisible = true;
    handleItemMouseMove(e);
}

// [canPlaceItem, findFreeSpace는 js/inventory.js로 분리되었습니다.]

// [MOD-022: 시스템 메뉴 및 설정 UI]
// [MOD-022: 모바일 톱니바퀴 버튼 및 시스템 메뉴 구현]
let isMenuOpen = false;

// 1. 공통 ESC / 뒤로가기 중앙 관제탑

const mobileMenuBtn = document.createElement("div");
mobileMenuBtn.id = "mobileMenuBtn";
mobileMenuBtn.innerHTML = "⚙️";
mobileMenuBtn.style.cssText = "position: fixed; top: 15px; right: 15px; width: 45px; height: 45px; background: rgba(0,0,0,0.7); border: 2px solid #666; border-radius: 8px; color: white; font-size: 24px; display: none; justify-content: center; align-items: center; z-index: 2500; cursor: pointer; user-select: none; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: background 0.1s;";
document.body.appendChild(mobileMenuBtn);

// 버튼 터치 액션 (터치 시 살짝 밝아지는 피드백 추가)
mobileMenuBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mobileMenuBtn.style.background = "rgba(100,100,100,0.9)";
    setTimeout(() => { mobileMenuBtn.style.background = "rgba(0,0,0,0.7)"; }, 150);
    handleEscAction();
});

// 3. 모바일 터치 기기에서만 버튼이 보이게 만드는 마법의 CSS 주입
const sysStyle = document.createElement("style");
sysStyle.innerHTML = `
            @media (pointer: coarse) { 
                #mobileMenuBtn { display: flex !important; } /* 터치스크린 감지 시 톱니바퀴 노출 */
            }
            .sys-btn {
                background: #333; color: white; border: 1px solid #666; padding: 14px; border-radius: 6px;
                font-size: 15px; font-weight: bold; cursor: pointer; transition: all 0.2s;
            }
            .sys-btn:hover { background: #555; border-color: white; transform: translateY(-2px); }
            .sys-btn:active { transform: translateY(0px); }
        `;
document.head.appendChild(sysStyle);

// 4. 시스템 메뉴(반투명 배경 및 팝업) 동적 생성
const sysMenuOverlay = document.createElement("div");
sysMenuOverlay.id = "sysMenuOverlay";
sysMenuOverlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); z-index: 15000; display: none; justify-content: center; align-items: center; backdrop-filter: blur(2px);";

sysMenuOverlay.innerHTML = `
            <div id="sysMenuMain" style="background: #1a1a1a; border: 2px solid #444; border-radius: 8px; padding: 30px; width: 280px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 15px;">
                <div style="color: #fff; font-weight: bold; font-size: 22px; margin-bottom: 15px; letter-spacing: 2px;">시스템 메뉴</div>
                <button class="sys-btn" onclick="toggleSystemMenu()">게임으로 돌아가기</button>
                <button class="sys-btn" onclick="openSysSettings()">설정</button>
                <button class="sys-btn" id="btnFullscreen" onclick="toggleFullScreen()">전체화면</button>
                <button class="sys-btn" style="background: #5a2222; border-color: #ff4444; color: #ffaaaa; margin-top: 10px;" onclick="returnToLobby()">로비로 돌아가기</button>
                <div id="lobbyNoti" style="color: #ff5555; font-size: 11px; height: 12px; margin-top: -5px; opacity: 0; transition: opacity 0.3s;">로비 시스템은 추후 업데이트 예정입니다.</div>
            </div>

            <div id="sysMenuSettings" style="display: none; background: #1a1a1a; border: 2px solid #444; border-radius: 8px; padding: 30px; width: 280px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8); flex-direction: column; gap: 15px;">
                <div style="color: gold; font-weight: bold; font-size: 20px; margin-bottom: 20px;">설정</div>
                <div style="color: #888; font-size: 14px; margin-bottom: 30px;">⚙️ 설정 기능 준비 중...</div>
                <button class="sys-btn" onclick="closeSysSettings()">뒤로 가기</button>
            </div>
        `;
document.body.appendChild(sysMenuOverlay);

// 5. 메뉴 로직 함수들
function toggleSystemMenu() {
    isMenuOpen = !isMenuOpen;

    const vpad = document.getElementById("vpad-container");
    if (isMenuOpen) {
        if (vpad) vpad.style.display = "none";
        sysMenuOverlay.style.display = "flex";
        document.getElementById("sysMenuMain").style.display = "flex";
        document.getElementById("sysMenuSettings").style.display = "none";
        document.getElementById("lobbyNoti").style.opacity = "0";

        keys = {}; // 조작 꼬임 방지 (미끄러짐 차단)

        const btnFs = document.getElementById("btnFullscreen");
        btnFs.innerText = document.fullscreenElement ? "창 모드" : "전체화면";
    } else {
        sysMenuOverlay.style.display = "none";
        closeSysSettings();
        if (gameState === "playing" && vpad) {
            vpad.style.display = "block";
        }
    }
}

function openSysSettings() {
    document.getElementById("sysMenuMain").style.display = "none";
    document.getElementById("sysMenuSettings").style.display = "flex";
}

function closeSysSettings() {
    document.getElementById("sysMenuMain").style.display = "flex";
    document.getElementById("sysMenuSettings").style.display = "none";
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
        document.getElementById("btnFullscreen").innerText = "창 모드";
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            document.getElementById("btnFullscreen").innerText = "전체화면";
        }
    }
}

let notiTimer;
function returnToLobby() {
    const noti = document.getElementById("lobbyNoti");
    noti.style.opacity = "1";
    clearTimeout(notiTimer);
    notiTimer = setTimeout(() => { noti.style.opacity = "0"; }, 2000);
}
// [MOD-022-END]

// [MOD-023: 버그 픽스 (인트로 퀵슬롯 깜빡임 방지 및 창고 오픈 기능 복구)]

// 1. [문제 1 완벽 해결] 새로고침(F5) 시 깜빡임(Flash) 방지를 위해 딜레이 없이 즉시 숨김 처리
(function hideVpadInstantly() {
    const vpad = document.getElementById("vpad-container");
    // 로딩 시점의 상태가 인트로/타이틀 관련 상태라면 자비 없이 바로 display: none 처리
    if (vpad && (gameState === "title" || gameState === "login" || gameState === "intro" || gameState === "lobby")) {
        vpad.style.display = "none";
    }
})();

// 2. [문제 2 해결] 누락되었던 창고 열기 함수 복구
// [openStorage는 js/inventory.js로 분리되었습니다.]
