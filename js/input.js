// [INPUT: 키보드, 마우스, 모바일 가상 패드 및 단축키 관리]

// [MOD-016: 입력 이벤트 리스너]
        // [MOD-016-1: 단축키 및 슬롯 클릭 처리]
        function selectQuickSlot(index) {
            if (gameState !== "playing" || player.dashTimer > 0) return;
            player.currentQuickSlotIdx = index;
            player.aimingSkill = null; 
            if (typeof updateQuickSlotUI === "function") updateQuickSlotUI();
        }

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (typeof handleEscAction === "function") handleEscAction();
                return;
            }

            if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return; 

            const introStates = ["title", "login", "intro", "lobby", "npcMenu"];
            if (introStates.includes(gameState)) return; 

            keys[e.key] = true;
            if (e.key.length === 1) keys[e.key.toLowerCase()] = true;

            // [R키: 스킬 퀵슬롯 우측 회전]
            const isRKey = e.code === "KeyR" || (e.key && (e.key.toLowerCase() === 'r' || e.key === 'ㄱ'));
            if (isRKey && gameState === "playing") handleRKey();

            // [E키: 스킬 퀵슬롯 좌측 회전]
            const isEKey = e.code === "KeyE" || (e.key && (e.key.toLowerCase() === 'e' || e.key === 'ㄷ'));
            if (isEKey && gameState === "playing") handleEKey();
            
            if (e.key.toLowerCase() === 'f' && gameState === "playing") {
                if (targetedFieldItem) {
                    pickupFieldItem(targetedFieldItem);
                } else if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && Array.isArray(MAP_DATA.dungeon.chests)) {
                    const pCenterX = player.x + player.width / 2;
                    const pCenterY = player.y + player.height / 2;
                    const nearChest = MAP_DATA.dungeon.chests.find(ch => !ch.opened && Math.hypot((ch.x + ch.w/2) - pCenterX, (ch.y + ch.h/2) - pCenterY) < 100);
                    if (nearChest && typeof openDungeonChest === "function") {
                        openDungeonChest(nearChest);
                    }
                }
            }

            // [Tab키 / I키: 인벤토리 및 창고 토글 (열기/닫기)]
            const isTabKey = e.code === "Tab" || e.key === "Tab" || (e.key && e.key.toLowerCase() === 'i');
            if (isTabKey && gameState !== "dead" && gameState !== "knockback") {
                e.preventDefault(); // 브라우저 기본 포커스 이동 방지
                const invUI = document.getElementById("inventoryUI");
                const isInvOpen = (invUI && invUI.style.display === "flex") || gameState === "inventory" || gameState === "storage";
                if (isInvOpen) {
                    if (typeof closeUI === "function") closeUI();
                } else if (gameState === "playing") {
                    if (window.isNearPersonalChest && typeof openStorage === "function") {
                        openStorage();
                    } else {
                        gameState = "inventory";
                        if (invUI) invUI.style.display = "flex";
                        const vpad = document.getElementById("vpad-container");
                        if (vpad) vpad.style.display = "none";
                        if (typeof switchTab === "function") switchTab('inv');
                    }
                }
            }
            
            // 숫자키 1~5로 스킬 덱 직접 선택
            if (gameState === "playing") {
                if (e.key >= '1' && e.key <= '5') { selectQuickSlot(parseInt(e.key) - 1); }
            }
        });

        window.addEventListener("keyup", (e) => { 
            keys[e.key] = false; 
            if (e.key.length === 1) keys[e.key.toLowerCase()] = false;
        });

        window.addEventListener("contextmenu", (e) => { e.preventDefault(); });

        // 화면 5칸을 클릭/터치 시 중앙으로 불러오기
        for (let i = 0; i < 5; i++) {
            let el = document.getElementById("q-slot-" + i);
            if (el) {
                const triggerIdx = () => {
                    if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
                    const N = player.quickSlots.length;
                    const centerIdx = player.currentQuickSlotIdx;
                    const displayIndices = [
                        (centerIdx - 2 + N) % N,
                        (centerIdx - 1 + N) % N,
                        centerIdx,
                        (centerIdx + 1) % N,
                        (centerIdx + 2) % N
                    ];
                    // 클릭한 위치에 해당하는 실제 스킬 인덱스로 장전
                    selectQuickSlot(displayIndices[i]); 
                };
                el.addEventListener("touchstart", (e) => { e.preventDefault(); triggerIdx(); });
                el.addEventListener("mousedown", (e) => { e.preventDefault(); triggerIdx(); });
            }
        }
        // [MOD-016-1-END]

        // [MOD-016-2: 마우스 상태 및 상호작용/전투 처리]
        let isRightMouseDown = false;

        canvas.addEventListener("mousemove", (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        });

        // [addFloatingText는 js/combat.js로 분리되었습니다.]

        // [마우스/터치 월드 인터랙션 및 공격 처리기]
        function handleCanvasInteraction(clientX, clientY, isRightClick = false) {
            if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return false; 
            if (gameState !== "playing") return false;

            const rect = canvas.getBoundingClientRect();
            const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
            const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

            mouseX = canvasX;
            mouseY = canvasY;

            const curZoom = (typeof cameraZoom !== "undefined") ? cameraZoom : 1.0;
            let wMouseX = (canvasX / curZoom) + camera.x;
            let wMouseY = (canvasY / curZoom) + camera.y;
            const pCenterX = player.x + player.width / 2;
            const pCenterY = player.y + player.height / 2;

            // 1) 우클릭 누름 -> 퀵슬롯 스킬 사용 준비(조준)
            if (isRightClick) { 
                if (typeof cancelBowCharging === "function") cancelBowCharging();
                aimCurrentQuickSlot(); 
                return true; 
            }

            // 2) 우클릭이 눌린 상태에서 좌클릭이 눌린 경우 -> 스킬 사용!
            if (isRightMouseDown && player.aimingSkill) { 
                if (typeof cancelBowCharging === "function") cancelBowCharging();
                executeAimingSkill(); 
                return true; 
            }

            // 3) 일반 좌클릭 시: 맵 상호작용(아이템, 상자, NPC, 포탈) 우선 검사
            if (targetedFieldItem) {
                let distToItem = Math.hypot(wMouseX - targetedFieldItem.x, wMouseY - targetedFieldItem.y);
                if (distToItem < 45) { 
                    pickupFieldItem(targetedFieldItem);
                    return true;
                }
            }

            if (currentMap === "guild" && typeof MAP_DATA !== "undefined") {
                const rec = MAP_DATA.guild.receptionist;
                const por = MAP_DATA.guild.portal;
                const chs = MAP_DATA.guild.personalChest;

                // 상자 유닛 네모 클릭 판정 (글씨 제외, 본체 사각형 영역)
                if (wMouseX >= chs.x && wMouseX <= chs.x + chs.w && wMouseY >= chs.y && wMouseY <= chs.y + chs.h) {
                    const distToChest = Math.hypot((chs.x + chs.w / 2) - pCenterX, (chs.y + chs.h / 2) - pCenterY);
                    if (distToChest < 140) {
                        openStorage();
                        return true;
                    } else {
                        if (typeof addFloatingText === "function") {
                            addFloatingText(player.x, player.y - 30, "상자가 너무 멉니다", "orange");
                        }
                        return true;
                    }
                }

                if (wMouseX >= rec.x && wMouseX <= rec.x + rec.size && wMouseY >= rec.y && wMouseY <= rec.y + rec.size) {
                    if (Math.hypot((rec.x + 15) - pCenterX, (rec.y + 15) - pCenterY) < 100) { 
                        openNPCMenu('receptionist'); 
                        return true; 
                    }
                }
                if (wMouseX >= por.x && wMouseX <= por.x + por.w && wMouseY >= por.y && wMouseY <= por.y + por.h) {
                    if (Math.hypot((por.x + 20) - pCenterX, (por.y + 100) - pCenterY) < 100) { 
                        openNPCMenu('portal'); 
                        return true; 
                    }
                }
            }
            
            if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined") {
                if (MAP_DATA.dungeon.portal) {
                    const dPor = MAP_DATA.dungeon.portal;
                    if (wMouseX >= dPor.x && wMouseX <= dPor.x + dPor.w && wMouseY >= dPor.y && wMouseY <= dPor.y + dPor.h) {
                        if (Math.hypot((dPor.x + dPor.w / 2) - pCenterX, (dPor.y + dPor.h / 2) - pCenterY) < 120) {
                            openNPCMenu('dungeon_portal');
                            return true;
                        }
                    }
                }
                // 던전 보물 상자 클릭 판정
                if (Array.isArray(MAP_DATA.dungeon.chests)) {
                    for (const ch of MAP_DATA.dungeon.chests) {
                        if (wMouseX >= ch.x - 5 && wMouseX <= ch.x + ch.w + 5 && wMouseY >= ch.y - 5 && wMouseY <= ch.y + ch.h + 5) {
                            if (Math.hypot((ch.x + ch.w / 2) - pCenterX, (ch.y + ch.h / 2) - pCenterY) < 110) {
                                if (typeof openDungeonChest === "function") {
                                    openDungeonChest(ch);
                                    return true;
                                }
                            } else {
                                if (typeof addFloatingText === "function") {
                                    addFloatingText(player.x, player.y - 30, "상자가 너무 멉니다", "orange");
                                }
                                return true;
                            }
                        }
                    }
                }
            }

            // 5) 활을 들고 있다면 차징 시작, 아니면 일반 근접 기본 공격 실행
            const wpn = player.equipment?.mainWeapon;
            const isBow = wpn && (wpn.baseId === "bow_basic" || (typeof ITEM_DB !== "undefined" && ITEM_DB[wpn.baseId]?.weaponType === "bow"));
            if (isBow) {
                if (typeof startBowCharging === "function") {
                    startBowCharging();
                    return true;
                }
            } else {
                if (typeof executeBasicAttack === "function") {
                    executeBasicAttack(wMouseX, wMouseY);
                    return true;
                }
            }

            return false;
        }

        canvas.addEventListener("mousedown", (e) => {
            if (e.button === 2) {
                isRightMouseDown = true;
                handleCanvasInteraction(e.clientX, e.clientY, true);
            } else if (e.button === 0) {
                handleCanvasInteraction(e.clientX, e.clientY, false);
            }
        });

        // 마우스 버튼 해제 시 처리 (좌클릭: 활 발사 / 우클릭: 조준 취소)
        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                if (typeof isBowCharging !== "undefined" && isBowCharging) {
                    const curZoom = (typeof cameraZoom !== "undefined") ? cameraZoom : 1.0;
                    let wMouseX = (mouseX / curZoom) + camera.x;
                    let wMouseY = (mouseY / curZoom) + camera.y;
                    if (typeof releaseBowShot === "function") {
                        releaseBowShot(wMouseX, wMouseY);
                    }
                }
            } else if (e.button === 2) {
                isRightMouseDown = false;
                if (player && player.aimingSkill) {
                    player.aimingSkill = null;
                }
            }
        });

        // 윈도우 포커스 해제 시 상태 초기화
        window.addEventListener("blur", () => {
            isRightMouseDown = false;
            if (typeof cancelBowCharging === "function") cancelBowCharging();
            if (player && player.aimingSkill) {
                player.aimingSkill = null;
            }
        });

        // 모바일 터치 탭 지원: 캔버스 터치 시 상자 네모 및 오브젝트 탭 상호작용
        canvas.addEventListener("touchstart", (e) => {
            if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
            if (gameState !== "playing") return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                handleCanvasInteraction(t.clientX, t.clientY, false);
            }
        }, { passive: true });

        // [MOD-016-3: 모바일 터치 패드 초기화]
        (function initVirtualPad() {
            const stickBase = document.getElementById("vpad-stick-base");
            const stickKnob = document.getElementById("vpad-stick-knob");
            const btnAtk = document.getElementById("vpad-atk");
            const btnSkill = document.getElementById("vpad-skill");
            const btnR = document.getElementById("vpad-r");
            const btnE = document.getElementById("vpad-e");

            let touchId = null;
            let startX = 0, startY = 0;

            window.addEventListener("touchstart", (e) => {
                if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return; 
                for (let i = 0; i < e.changedTouches.length; i++) {
                    let t = e.changedTouches[i];
                    if (t.clientX < window.innerWidth / 2 && touchId === null) {
                        touchId = t.identifier;
                        startX = t.clientX;
                        startY = t.clientY;
                        if(stickBase) {
                            stickBase.style.left = (startX - (window.innerWidth * 0.08)) + "px";
                            stickBase.style.top = (startY - (window.innerHeight * 0.08)) + "px";
                            stickBase.style.bottom = "auto";
                            stickBase.style.display = "block";
                            if(stickKnob) stickKnob.style.transform = `translate(0px, 0px)`;
                        }
                    }
                }
            }, { passive: false });

            window.addEventListener("touchmove", (e) => {
                if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return; 
                for (let i = 0; i < e.changedTouches.length; i++) {
                    let t = e.changedTouches[i];
                    if (t.identifier === touchId) {
                        let dx = t.clientX - startX;
                        let dy = t.clientY - startY;
                        let dist = Math.hypot(dx, dy);
                        let maxR = 45; 
                        if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
                        if(stickKnob) stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

                        keys["w"] = dy < -12; keys["s"] = dy > 12;
                        keys["a"] = dx < -12; keys["d"] = dx > 12;

                        if (dist > 5) {
                            let moveAngle = Math.atan2(dy, dx);
                            let screenPx = player.x + player.width/2 - camera.x;
                            let screenPy = player.y + player.height/2 - camera.y;
                            
                            mouseX = screenPx + Math.cos(moveAngle) * 120;
                            mouseY = screenPy + Math.sin(moveAngle) * 120;
                        }
                    }
                }
            }, { passive: false });

            const endTouch = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === touchId) {
                        touchId = null;
                        if(stickBase) stickBase.style.display = "none";
                        keys["w"] = false; keys["s"] = false; keys["a"] = false; keys["d"] = false;
                    }
                }
            };
            window.addEventListener("touchend", endTouch);
            window.addEventListener("touchcancel", endTouch);

            if(btnAtk) btnAtk.addEventListener("touchstart", (e) => { 
                if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
                e.preventDefault(); canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0 })); 
            });
            if(btnSkill) btnSkill.addEventListener("touchstart", (e) => { 
                if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
                e.preventDefault(); canvas.dispatchEvent(new MouseEvent("mousedown", { button: 2 })); 
            });
            if(btnR) btnR.addEventListener("touchstart", (e) => { 
                if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
                e.preventDefault(); handleRKey(); 
            });
            
            if(btnE) btnE.addEventListener("touchstart", (e) => {
                if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
                e.preventDefault();
                const invUI = document.getElementById("inventoryUI");
                const isInvOpen = (invUI && invUI.style.display === "flex") || gameState === "inventory" || gameState === "storage";
                if (isInvOpen) {
                    if (typeof closeUI === "function") closeUI();
                } else if (gameState === "playing") {
                    if (window.isNearPersonalChest && typeof openStorage === "function") {
                        openStorage();
                    } else {
                        gameState = "inventory";
                        if (invUI) invUI.style.display = "flex";
                        const vpad = document.getElementById("vpad-container");
                        if (vpad) vpad.style.display = "none";
                        if (typeof switchTab === "function") switchTab('inv');
                    }
                }
            });
        })();
        // [MOD-016-3-END]
        
        // [MOD-017: UI 제어 및 충돌(Collision) 유틸리티]
        
 // [MOD-017-1: 장비창 UI 업데이트, 인챈트 로직 및 스마트 알림 뱃지 (스탯 패널 연동을 위한 터치 정리)]
        let currentRightView = 'inventory'; 
        // [인챈트 슬롯 등록/해제는 js/inventory.js로 분리되었습니다.]

// [ESC 및 뒤로가기 중앙 관제탑]
function handleEscAction() {
            if (typeof isMenuOpen !== 'undefined' && isMenuOpen) {
                toggleSystemMenu(); // 메뉴가 열려있으면 닫기
            } else if (gameState === "inventory" || gameState === "storage") {
                if (typeof closeUI === "function") closeUI(); // 가방/창고가 열려있으면 닫기
            } else if (gameState === "playing") {
                toggleSystemMenu(); // 평상시면 메뉴 열기
            }
        }

        // 2. 모바일 전용 톱니바퀴 버튼 생성 및 바디에 부착
