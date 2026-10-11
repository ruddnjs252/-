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

            if (e.key.toLowerCase() === 'r') handleRKey();
            
            if (e.key.toLowerCase() === 'f' && gameState === "playing") {
                if (targetedFieldItem) pickupFieldItem(targetedFieldItem);
            }

            if ((e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'i') && gameState !== "dead" && gameState !== "knockback") {
                if (gameState === "playing") {
                    gameState = "inventory";
                    document.getElementById("inventoryUI").style.display = "flex";
                    document.getElementById("vpad-container").style.display = "none";
                    if(typeof switchTab === "function") switchTab('inv');
                } else {
                    if(typeof closeUI === "function") closeUI();
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

        // [MOD-016-2: 마우스 이동 및 클릭 처리]
        canvas.addEventListener("mousemove", (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        });

        // [addFloatingText는 js/combat.js로 분리되었습니다.]

        canvas.addEventListener("mousedown", (e) => {
            if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return; 
            if (gameState !== "playing") return;

            let wMouseX = mouseX + camera.x;
            let wMouseY = mouseY + camera.y;
            const pCenterX = player.x + player.width / 2;
            const pCenterY = player.y + player.height / 2;

            if (e.button === 2) { aimCurrentQuickSlot(); return; }

            if (e.button === 0) { 
                if (player.aimingSkill) { executeAimingSkill(); return; }

                if (targetedFieldItem) {
                    let distToItem = Math.hypot(wMouseX - targetedFieldItem.x, wMouseY - targetedFieldItem.y);
                    if (distToItem < 45) { 
                        pickupFieldItem(targetedFieldItem);
                        return;
                    }
                }

                if (currentMap === "guild" && typeof MAP_DATA !== "undefined") {
                    const rec = MAP_DATA.guild.receptionist;
                    const por = MAP_DATA.guild.portal;
                    const chs = MAP_DATA.guild.personalChest;
                    if (wMouseX >= rec.x && wMouseX <= rec.x + rec.size && wMouseY >= rec.y && wMouseY <= rec.y + rec.size) {
                        if (Math.hypot((rec.x+15) - pCenterX, (rec.y+15) - pCenterY) < 100) { openNPCMenu('receptionist'); return; }
                    }
                    if (wMouseX >= por.x && wMouseX <= por.x + por.w && wMouseY >= por.y && wMouseY <= por.y + por.h) {
                        if (Math.hypot((por.x+20) - pCenterX, (por.y+100) - pCenterY) < 100) { openNPCMenu('portal'); return; }
                    }
                    if (wMouseX >= chs.x && wMouseX <= chs.x + chs.w && wMouseY >= chs.y && wMouseY <= chs.y + chs.h) {
                        if (Math.hypot((chs.x+chs.w/2) - pCenterX, (chs.y+chs.h/2) - pCenterY) < 100) { openStorage(); return; }
                    }
                }
                
                if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon.goblin.active) {
                    const gob = MAP_DATA.dungeon.goblin;
                    if (Math.hypot(wMouseX - gob.x, wMouseY - gob.y) < gob.size) {
                        player.lockedTarget = gob;
                        addFloatingText(gob.x, gob.y - 30, "타겟 고정!", "red");
                    } else {
                        player.lockedTarget = null;
                    }
                }
            }
        });

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
                if (gameState === "playing") {
                    gameState = "inventory";
                    document.getElementById("inventoryUI").style.display = "flex";
                    document.getElementById("vpad-container").style.display = "none";
                    if(typeof switchTab === "function") switchTab('inv');
                } else {
                    if(typeof closeUI === "function") closeUI();
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
