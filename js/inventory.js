
// [MOD-021: 유틸리티 및 툴팁 시스템]
let tooltipTimer = null;
let tooltipVisible = false;
let tooltipEl = typeof document !== 'undefined' ? document.querySelector(".item-tooltip") : null;

if (typeof document !== 'undefined') {
    if (!tooltipEl && document.body) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "item-tooltip";
        document.body.appendChild(tooltipEl);
    }
    document.addEventListener("touchstart", (e) => {
        if (tooltipVisible && tooltipEl && !tooltipEl.contains(e.target)) {
            handleItemMouseLeave();
        }
    });
}

function handleItemMouseEnter(e, itemObj) {
    if (typeof dragItemState !== "undefined" && dragItemState.active) return;
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => showTooltip(e, itemObj), 1000); 
}

function handleItemMouseLeave() {
    clearTimeout(tooltipTimer);
    if (tooltipEl) tooltipEl.style.display = "none";
    tooltipVisible = false;
}

function handleItemMouseMove(e) {
    if (!tooltipVisible || !tooltipEl) return;
    let x = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    let y = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    
    if (x + 180 > window.innerWidth) x -= 180; 
    if (y + 150 > window.innerHeight) y -= 150; 
    
    tooltipEl.style.left = (x + 15) + "px";
    tooltipEl.style.top = (y + 15) + "px";
}

function showTooltip(e, itemObj) {
    if (typeof dragItemState !== "undefined" && dragItemState.active) return;
    const baseItem = ITEM_DB[itemObj.baseId];
    if (!baseItem || !tooltipEl) return;

    let titleHtml = baseItem.name;
    let typeKor = baseItem.type === "equip" ? `[장비 - ${SLOT_HINTS[baseItem.equipSlot] || baseItem.equipSlot}]` : (baseItem.type === "enchant" ? "[인챈트 두루마리]" : `[${baseItem.type}]`);
    
    let statHtml = "";
    if(baseItem.stats) {
        for(let k in baseItem.stats) statHtml += `<div>${k}: +${baseItem.stats[k]}</div>`;
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

// [INVENTORY: 그리드 인벤토리, 장비 슬롯, 테트리스 회전, 드래그앤드롭, 인챈트 및 창고 시스템]

// [인챈트 작업 전역 상태 및 슬롯 힌트]
        let currentEnchantTargetSlot = null; 
        let pendingEnchant = null; 

        const SLOT_HINTS = {
            head: "머리", mainWeapon: "주무기", chest: "갑옷",
            subWeapon: "부무기", shoes: "신발", throwable: "" 
        };

        function clearEnchantRegistration() {
            if (!currentEnchantTargetSlot) return; 
            currentEnchantTargetSlot = null;
            pendingEnchant = null; 
            window.pendingEnchant = null; 
            
            const content = document.getElementById("enchantContent");
            const targetSlotHint = document.getElementById("enchantTargetHint");
            const targetSlot = document.getElementById("enchantTargetSlot");
            
            if (targetSlotHint) targetSlotHint.innerHTML = `장비<br>등록`;
            if (targetSlot) {
                targetSlot.style.borderColor = "#666"; 
                targetSlot.style.backgroundColor = "#222";
            }
            if (content) content.innerHTML = `좌측 장비창에서 장비를<br>클릭하여 올려주세요.`;
            
            updateNotiBadges(); 
        }

        setTimeout(() => {
            const targetSlot = document.getElementById("enchantTargetSlot");
            if (targetSlot) {
                targetSlot.addEventListener("click", clearEnchantRegistration);
                targetSlot.style.cursor = "pointer"; 
            }
        }, 500);

// [장착 슬롯 UI 렌더링]
        function renderEquipSlotsUI() {
            for(let slot in player.equipment) {
                let el = document.querySelector(`.slot-${slot}, [data-slot="${slot}"]`);
                if(!el) continue;
                
                let item = player.equipment[slot];
                
                el.onmousedown = null; el.ontouchstart = null;

                if(item) {
                    let baseItem = ITEM_DB[item.baseId];
                    el.style.backgroundColor = baseItem.color;
                    el.innerHTML = `<span style="color:white; font-size:9px; font-weight:bold; pointer-events:none; text-align:center;">${baseItem.name}</span>`;
                    
                    // [개선] 단순 클릭 시 상세창 팝업, 드래그(이동) 시 드래그 모드 분기
                    bindEquipSlotInput(el, slot, item);
                } else {
                    el.style.backgroundColor = "#2a2a2a";
                    let hintText = SLOT_HINTS[slot] || "";
                    el.innerHTML = hintText ? `<span class="slot-hint">${hintText}</span>` : "";
                }
            }
            if (typeof updateNotiBadges === "function") {
                setTimeout(updateNotiBadges, 10);
            }
        }

        // [장비 슬롯 인터랙션: 클릭 시 상세창 팝업 / 이동 시 드래그 앤 드롭]
        function bindEquipSlotInput(el, slot, item) {
            let startX = 0, startY = 0;
            let isPressing = false;
            let isDragging = false;

            const onDown = (e) => {
                if (e.type === "mousedown" && e.button !== 0) return;
                if (typeof currentRightView !== "undefined" && currentRightView === 'enchant') return;

                const pt = e.touches ? e.touches[0] : e;
                startX = pt.clientX;
                startY = pt.clientY;
                isPressing = true;
                isDragging = false;

                const onMove = (ev) => {
                    if (!isPressing) return;
                    const mpt = ev.touches ? ev.touches[0] : ev;
                    const dist = Math.hypot(mpt.clientX - startX, mpt.clientY - startY);
                    if (dist > 5 && !isDragging) {
                        isDragging = true;
                        cleanup();
                        startDragFromEquip(ev, slot, item);
                    }
                };

                const onUp = (ev) => {
                    if (!isPressing) return;
                    cleanup();
                    if (!isDragging) {
                        openItemDetail(item, "equipment", slot);
                    }
                };

                const cleanup = () => {
                    isPressing = false;
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                    document.removeEventListener("touchmove", onMove);
                    document.removeEventListener("touchend", onUp);
                };

                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
                document.addEventListener("touchmove", onMove, { passive: false });
                document.addEventListener("touchend", onUp);
            };

            el.onmousedown = onDown;
            el.ontouchstart = (e) => {
                if (typeof currentRightView !== "undefined" && currentRightView !== 'enchant') {
                    e.preventDefault();
                    onDown(e);
                }
            };
        }


// [사용 가능한 인챈트 두루마리 목록 조회: 인벤토리 기본 + 창고가 열려있을 때만 창고 포함]
        function getAvailableEnchantScrolls() {
            let scrolls = (typeof myInventoryItems !== "undefined" && Array.isArray(myInventoryItems)) ? [...myInventoryItems] : [];
            if (typeof gameState !== "undefined" && gameState === "storage" && typeof personalStorage !== "undefined" && Array.isArray(personalStorage)) {
                scrolls = scrolls.concat(personalStorage);
            }
            return scrolls;
        }
        window.getAvailableEnchantScrolls = getAvailableEnchantScrolls;

// [인챈트 상호작용 및 주문서 적용 함수군]
        function selectEquipSlotForEnchant(slotNameKOR, slotKey) {
            if (currentRightView !== 'enchant') return;
            
            const content = document.getElementById("enchantContent");
            const targetSlotHint = document.getElementById("enchantTargetHint");
            const targetSlot = document.getElementById("enchantTargetSlot");
            
            currentEnchantTargetSlot = slotKey;
            let item = player.equipment[slotKey];

            if(!item) {
                targetSlotHint.innerHTML = `장비<br>등록`;
                targetSlot.style.borderColor = "#666"; targetSlot.style.backgroundColor = "#222";
                content.innerHTML = `좌측 장비창에서 장비를<br>클릭하여 올려주세요.`;
                updateNotiBadges();
                return;
            }

            let baseItem = ITEM_DB[item.baseId];
            targetSlotHint.innerHTML = `<span style="color: white; font-weight: bold; font-size: 11px;">${baseItem.name}</span>`;
            targetSlot.style.borderColor = "gold"; targetSlot.style.backgroundColor = baseItem.color;

            let allScrolls = getAvailableEnchantScrolls();
            let equippedEnchants = item.sockets.filter(s => s !== null).map(s => typeof s === "string" ? s : s.baseId);
            let hasNewScroll = allScrolls.some(i => ITEM_DB[i.baseId] && ITEM_DB[i.baseId].type === "enchant" && !equippedEnchants.includes(i.baseId));
            
            let foundFirstEmpty = false;
            let socketsHtml = '';
            
            for(let i = 0; i < baseItem.maxSockets; i++) {
                let sock = item.sockets[i];
                let isPendingThis = (pendingEnchant && pendingEnchant.slotKey === slotKey && pendingEnchant.socketIndex === i);

                if (isPendingThis) {
                    let pScroll = myInventoryItems.find(x => (x.id||x.uid) === pendingEnchant.scrollId) || personalStorage.find(x => (x.id||x.uid) === pendingEnchant.scrollId);
                    if (pScroll) {
                        let effect = ITEM_DB[pScroll.baseId].enchantEffect;
                        let curLevel = (sock && typeof sock === "object" && sock.level) ? sock.level : (sock ? 1 : 0);
                        let nextLevel = curLevel + 1;
                        let nextVal = effect.value * nextLevel;
                        socketsHtml += `<div class="socket-slot socket-animated" style="background:#ff8800; border:2px dashed gold; animation: pulse-noti 1.2s infinite; position:relative; cursor:pointer;">
                            <span style="font-size:9px; color:#fff; font-weight:bold; line-height:1.1; display:block; text-align:center;">강타+${nextLevel}<br><span style="font-size:8px; color:gold;">${effect.stat}+${nextVal}</span></span>
                        </div>`;
                    }
                } else if (sock) {
                    let baseId = typeof sock === "string" ? sock : sock.baseId;
                    let level = (typeof sock === "object" && sock.level) ? sock.level : 1;
                    let effect = ITEM_DB[baseId] ? ITEM_DB[baseId].enchantEffect : { stat: "str", value: 5, name: "강타" };
                    let totalVal = effect.value * level;

                    // 가방 또는 열린 창고에 동일한 인챈트 두루마리가 있을 경우 중복 강화 알림 '!' 뱃지 표시
                    let hasDupeScroll = allScrolls.some(s => s.baseId === baseId);
                    let badgeHtml = "";
                    let clickAction = "";

                    if (hasDupeScroll && !pendingEnchant) {
                        badgeHtml = `<div class="noti-badge socket-badge">!</div>`;
                    }

                    // [강타1] 등의 소켓을 누르면 강화 재료 선택 팝업을 열어 유저가 원하는 두루마리를 선택하도록 유도
                    if (!pendingEnchant) {
                        clickAction = `onclick="openUpgradeEnchantPopup('${slotKey}', ${i}, '${baseId}')" style="cursor:pointer;"`;
                    }

                    socketsHtml += `<div class="socket-slot socket-animated" style="background:#ff4444; border-color:white; position:relative;" ${clickAction}>
                        ${badgeHtml}
                        <span style="font-size:9px; color:#fff; font-weight:bold; line-height:1.1; display:block; text-align:center;">강타+${level}<br><span style="font-size:8px; color:gold;">${effect.stat}+${totalVal}</span></span>
                    </div>`;
                } else {
                    let badgeHtml = "";
                    if (!foundFirstEmpty && hasNewScroll && !pendingEnchant) {
                        badgeHtml = `<div class="noti-badge socket-badge">!</div>`;
                        foundFirstEmpty = true; 
                    }
                    socketsHtml += `<div class="socket-slot socket-animated" style="position:relative; cursor:pointer;" onclick="openEnchantPopup('${slotKey}', ${i})">${badgeHtml}</div>`;
                }
            }

            let confirmUI = '';
            if (pendingEnchant && pendingEnchant.slotKey === slotKey) {
                let msg = pendingEnchant.isUpgrade ? "중복 강화로 소켓 레벨을 올리시겠습니까?" : "인챈트를 적용하시겠습니까?";
                confirmUI = `
                    <div style="font-size: 11px; color: gold; text-align: center; margin-bottom: 4px;">${msg}</div>
                    <div style="display:flex; gap:10px; justify-content:center; margin-top: 4px; position:relative; z-index:10;">
                        <button style="padding:7px 20px; background:limegreen; border:2px solid white; color:white; font-weight:bold; border-radius:4px; cursor:pointer;" onclick="confirmPendingEnchant()">확정</button>
                        <button style="padding:7px 20px; background:gray; border:2px solid white; color:white; font-weight:bold; border-radius:4px; cursor:pointer;" onclick="cancelPendingEnchant('${slotNameKOR}', '${slotKey}')">취소</button>
                    </div>
                `;
            } else {
                confirmUI = `<div style="font-size: 11px; color: #888; text-align: center;">빈 소켓 또는 '!' 소켓을 클릭하면<br>인챈트 및 중복 강화를 진행합니다.</div>`;
            }

            content.innerHTML = `
                <div style="display: flex; gap: 14px; justify-content: center; align-items: center; margin-bottom: 12px;">
                    ${socketsHtml}
                </div>
                ${confirmUI}
            `;
            
            setTimeout(updateNotiBadges, 10); 
        }

        // [중복 강화 재료 선택 팝업: 소켓을 눌렀을 때 사용 가능한 강화 재료 인챈트 목록을 보여주고 선택]
        function openUpgradeEnchantPopup(slotKey, socketIndex, baseId) {
            let allScrolls = getAvailableEnchantScrolls();
            let targetScrolls = allScrolls.filter(i => {
                if (!ITEM_DB[i.baseId] || ITEM_DB[i.baseId].type !== "enchant") return false;
                return i.baseId === baseId;
            });

            let popup = document.getElementById("enchantPopupUI");
            if (!popup) return;

            let baseInfo = ITEM_DB[baseId];
            let effectName = (baseInfo && baseInfo.enchantEffect) ? baseInfo.enchantEffect.name : "강타";

            if (targetScrolls.length === 0) {
                popup.innerHTML = `
                    <div style="color:gold; font-weight:bold; font-size:12px; margin-bottom:8px; text-align:center;">중복 강화 재료 선택</div>
                    <div style="color:#bbb; font-size:11px; text-align:center; line-height:1.5;">
                        강화 재료로 사용할 [${effectName}] 두루마리가 없습니다.<br>
                        <span style="color:#888; font-size:10px;">(가방에 소지하거나 창고를 연 상태에서 이용할 수 있습니다.)</span>
                    </div>
                    <button onclick="document.getElementById('enchantPopupUI').style.display='none'" style="margin-top:12px; background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">닫기</button>
                `;
            } else {
                let listHtml = targetScrolls.map(scroll => {
                    let base = ITEM_DB[scroll.baseId];
                    let isInv = myInventoryItems.some(i => (i.id || i.uid) === (scroll.id || scroll.uid));
                    let sourceText = isInv ? "가방" : "창고";
                    let sourceColor = isInv ? "#4fc3f7" : "#ffb74d";
                    let sId = scroll.id || scroll.uid;
                    let eff = base.enchantEffect ? `${base.enchantEffect.stat.toUpperCase()} +${base.enchantEffect.value}` : "";

                    return `
                        <div class="enchant-scroll-item" onclick="stageUpgradeEnchant('${slotKey}', ${socketIndex}, '${sId}')" style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; margin:4px 0; background:rgba(255,255,255,0.08); border:1px solid #555; border-radius:4px; cursor:pointer;">
                            <div style="text-align:left;">
                                <span style="color:${sourceColor}; font-size:10px; font-weight:bold; margin-right:4px;">[${sourceText}]</span>
                                <span style="color:#fff; font-size:11px; font-weight:bold;">${base.name}</span>
                                <span style="color:gold; font-size:10px; margin-left:4px;">(${eff})</span>
                            </div>
                            <div style="color:#00ffcc; font-size:10px; font-weight:bold; border:1px solid #00ffcc; padding:2px 6px; border-radius:3px;">
                                선택
                            </div>
                        </div>
                    `;
                }).join('');

                popup.innerHTML = `
                    <div style="color:gold; font-weight:bold; font-size:12px; margin-bottom:4px; text-align:center;">중복 강화 재료 선택</div>
                    <div style="color:#aaa; font-size:10px; margin-bottom:10px; text-align:center;">강화에 소모할 인챈트 두루마리를 선택하세요.</div>
                    <div style="max-height:180px; overflow-y:auto; width:100%; display:flex; flex-direction:column; gap:4px;">
                        ${listHtml}
                    </div>
                    <button onclick="document.getElementById('enchantPopupUI').style.display='none'" style="margin-top:10px; background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">취소</button>
                `;
            }
            popup.style.display = 'flex';
        }

        // [중복 강화 스테이징: 유저가 선택한 두루마리로 소켓 업그레이드 등록]
        function stageUpgradeEnchant(slotKey, socketIndex, scrollId) {
            let popup = document.getElementById('enchantPopupUI');
            if (popup) popup.style.display = 'none';

            let allScrolls = getAvailableEnchantScrolls();
            let scroll = allScrolls.find(s => (s.id || s.uid) === scrollId);
            if (!scroll) return;

            pendingEnchant = {
                slotKey: slotKey,
                socketIndex: socketIndex,
                scrollId: scroll.id || scroll.uid,
                isUpgrade: true
            };
            window.pendingEnchant = pendingEnchant;
            let slotEl = document.querySelector(`[data-slot="${slotKey}"]`);
            let slotNameKOR = slotEl ? slotEl.innerText : "";
            selectEquipSlotForEnchant(slotNameKOR, slotKey);
        }

        function openEnchantPopup(slotKey, socketIndex) {
            let allScrolls = getAvailableEnchantScrolls();
            let item = player.equipment[slotKey];
            let equippedEnchants = (item && item.sockets) ? item.sockets.filter(s => s !== null).map(s => typeof s === "string" ? s : s.baseId) : [];

            // 이미 장착된 인챈트는 빈 소켓에 중복으로 넣을 수 없도록 원천 제외
            let scrolls = allScrolls.filter(i => ITEM_DB[i.baseId] && ITEM_DB[i.baseId].type === "enchant" && !equippedEnchants.includes(i.baseId));
            let popup = document.getElementById("enchantPopupUI");
            if (!popup) return;
            
            if(scrolls.length === 0) {
                popup.innerHTML = `<div style="color:gray; font-size:11px; text-align:center; line-height:1.5;">사용 가능한 새로운 인챈트 두루마리가 없습니다.<br><span style="color:gold;">(이미 장착된 인챈트는 기존 소켓에서 중복 강화(!)를 진행하세요.)</span></div>
                <button onclick="document.getElementById('enchantPopupUI').style.display='none'" style="margin-top:10px; background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">닫기</button>`;
            } else {
                let listHtml = scrolls.map(scroll => {
                    let base = ITEM_DB[scroll.baseId];
                    let isInv = myInventoryItems.some(i => (i.id || i.uid) === (scroll.id || scroll.uid));
                    let sourceText = isInv ? "가방" : "창고";
                    let sourceColor = isInv ? "#4fc3f7" : "#ffb74d";
                    let sId = scroll.id || scroll.uid;
                    let eff = base.enchantEffect ? `${base.enchantEffect.stat.toUpperCase()} +${base.enchantEffect.value}` : "";

                    return `<div class="enchant-scroll-item" onclick="stageEnchant('${slotKey}', ${socketIndex}, '${sId}')" style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; margin:4px 0; background:rgba(255,255,255,0.08); border:1px solid #555; border-radius:4px; cursor:pointer;">
                        <div style="text-align:left;">
                            <span style="color:${sourceColor}; font-size:10px; font-weight:bold; margin-right:4px;">[${sourceText}]</span>
                            <span style="color:#fff; font-size:11px; font-weight:bold;">${base.name}</span>
                            <span style="color:gold; font-size:10px; margin-left:4px;">(${eff})</span>
                        </div>
                        <div style="color:#00ffcc; font-size:10px; font-weight:bold; border:1px solid #00ffcc; padding:2px 6px; border-radius:3px;">
                            선택
                        </div>
                    </div>`;
                }).join('');
                
                popup.innerHTML = `<div style="color:gold; font-weight:bold; font-size:12px; margin-bottom:4px; text-align:center;">인챈트 선택</div>
                <div style="color:#aaa; font-size:10px; margin-bottom:10px; text-align:center;">빈 소켓에 장착할 두루마리를 선택하세요.</div>
                <div style="max-height:180px; overflow-y:auto; width:100%; display:flex; flex-direction:column; gap:4px;">
                    ${listHtml}
                </div>
                <button onclick="document.getElementById('enchantPopupUI').style.display='none'" style="margin-top:10px; background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">취소</button>`;
            }
            popup.style.display = 'flex';
        }

        function stageEnchant(slotKey, socketIndex, scrollId) {
            let item = player.equipment[slotKey];
            let allScrolls = getAvailableEnchantScrolls();
            let scroll = allScrolls.find(x => (x.id || x.uid) === scrollId);

            if (item && item.sockets && scroll) {
                let equippedEnchants = item.sockets.filter(s => s !== null).map(s => typeof s === "string" ? s : s.baseId);
                if (equippedEnchants.includes(scroll.baseId)) {
                    alert("동일한 인챈트는 다른 소켓에 중복 장착할 수 없습니다. 기존 소켓에서 중복 강화를 진행하세요.");
                    document.getElementById('enchantPopupUI').style.display = 'none';
                    return;
                }
            }

            pendingEnchant = { slotKey, socketIndex, scrollId, isUpgrade: false };
            window.pendingEnchant = pendingEnchant;
            document.getElementById('enchantPopupUI').style.display = 'none';
            let slotEl = document.querySelector(`[data-slot="${slotKey}"]`);
            let slotNameKOR = slotEl ? slotEl.innerText : "";
            selectEquipSlotForEnchant(slotNameKOR, slotKey); 
        }

        function confirmPendingEnchant() {
            if(!pendingEnchant) return;
            let slotKey = pendingEnchant.slotKey;
            let socketIndex = pendingEnchant.socketIndex;
            let scrollId = pendingEnchant.scrollId;
            let isUpgrade = pendingEnchant.isUpgrade;
            
            let item = player.equipment[slotKey];
            let scroll = null;
            
            let invIdx = myInventoryItems.findIndex(i => (i.id || i.uid) === scrollId);
            if (invIdx > -1) {
                scroll = myInventoryItems.splice(invIdx, 1)[0];
            } else if (typeof gameState !== "undefined" && gameState === "storage") {
                let stoIdx = personalStorage.findIndex(i => (i.id || i.uid) === scrollId);
                if (stoIdx > -1) {
                    scroll = personalStorage.splice(stoIdx, 1)[0];
                    if (typeof renderGridInventory === "function") renderGridInventory();
                }
            }
            
            if (scroll) {
                if (isUpgrade) {
                    let cur = item.sockets[socketIndex];
                    let sockObj = (typeof cur === "string") ? { baseId: cur, level: 1 } : { ...cur };
                    sockObj.level = (sockObj.level || 1) + 1;
                    item.sockets[socketIndex] = sockObj;
                    if (typeof addFloatingText === "function") {
                        addFloatingText(player.x, player.y - 40, `강타+${sockObj.level} 강화 성공!`, "gold");
                    }
                } else {
                    item.sockets[socketIndex] = { baseId: scroll.baseId, level: 1 };
                    if (typeof addFloatingText === "function") {
                        addFloatingText(player.x, player.y - 40, "인챈트 성공!", "#00ffcc");
                    }
                }
            } else {
                alert("선택한 두루마리를 찾을 수 없습니다.");
            }
            
            pendingEnchant = null;
            window.pendingEnchant = null;
            updatePlayerTotalStats();
            if (typeof renderEquipSlotsUI === "function") renderEquipSlotsUI();
            if (typeof renderGridInventory === "function") renderGridInventory();
            
            let slotEl = document.querySelector(`[data-slot="${slotKey}"]`);
            let slotNameKOR = slotEl ? slotEl.innerText : "";
            selectEquipSlotForEnchant(slotNameKOR, slotKey); 
        }

        function cancelPendingEnchant(slotNameKOR, slotKey) {
            pendingEnchant = null;
            window.pendingEnchant = null;
            selectEquipSlotForEnchant(slotNameKOR, slotKey);
        }


// [MOD-020: 그리드 인벤토리 코어 시스템]
// [MOD-020-1: 그리드 환경 변수 및 장비 슬롯 정의]
        const GRID_CELL_SIZE = 40; 
        const INV_COLS = 8;        
        const BASE_INV_ROWS = 3;   // [기본 인벤토리: 가방 미착용 시 8x3 고정]
        const STORAGE_ROWS = 10;   // [개인 창고: 8x10 고정]
        const INV_ROWS = 10;       // 하위 호환성 유지용

        // [플레이어 가방 장착 슬롯 5개]
        if (typeof player !== "undefined" && !player.equippedBags) {
            player.equippedBags = [null, null, null, null, null];
        }

        // [컨테이너별 2차원 격자 맵]
        let containerMaps = {
            main: Array.from({ length: BASE_INV_ROWS }, () => Array(INV_COLS).fill(null)),
            storage: Array.from({ length: STORAGE_ROWS }, () => Array(INV_COLS).fill(null))
        };
        for (let i = 0; i < 5; i++) {
            containerMaps['bag_' + i] = null;
        }

        // 하위 호환 참조
        let gridMap = containerMaps.main;
        let storageMap = containerMaps.storage;
        
        let equipmentSlots = {
            helmet: null,   
            armor: "item_2",    
            weapon: "item_1",   
            accessory: null 
        };

        let myInventoryItems = []; // [인벤토리 소지품 배열]
        window.myInventoryItems = myInventoryItems;

        // [개인 창고(personalStorage) 초기 배치 - 기본 아이템 7종 + 가방 3종 겹침 없이 배치]
        if (typeof personalStorage !== "undefined") {
            if (personalStorage.length === 0) {
                personalStorage.push(
                    { id: "item_sword_1", baseId: "sword_basic", container: "storage", gridX: 0, gridY: 0, rot: 0 }, // 1x3
                    { id: "item_armor_1", baseId: "armor_iron",  container: "storage", gridX: 2, gridY: 0, rot: 0 }, // 2x3
                    { id: "item_pot_1",   baseId: "potion_hp",   container: "storage", gridX: 5, gridY: 0, rot: 0 }, // 1x1
                    { id: "item_pot_2",   baseId: "potion_hp",   container: "storage", gridX: 6, gridY: 0, rot: 0 }, // 1x1
                    { id: "item_axe_1",   baseId: "axe_battle",  container: "storage", gridX: 0, gridY: 4, rot: 0 }, // 2x3
                    { id: "scroll_1",     baseId: "scroll_smite", container: "storage", gridX: 3, gridY: 4, rot: 0 }, // 1x1
                    { id: "scroll_2",     baseId: "scroll_smite", container: "storage", gridX: 4, gridY: 4, rot: 0 }, // 1x1
                    { id: "book_teleport_1", baseId: "book_teleport", container: "storage", gridX: 5, gridY: 4, rot: 0 }, // 1x1
                    // ★ 신규 가방 3종 배치
                    { id: "bag_s_1", baseId: "bag_small",  container: "storage", gridX: 0, gridY: 7, rot: 0 }, // 2x2 (0,7 ~ 1,8)
                    { id: "bag_m_1", baseId: "bag_medium", container: "storage", gridX: 3, gridY: 7, rot: 0 }, // 2x2 (3,7 ~ 4,8)
                    { id: "bag_l_1", baseId: "bag_large",  container: "storage", gridX: 6, gridY: 7, rot: 0 }  // 2x2 (6,7 ~ 7,8)
                );
            }
        }

        // [컨테이너 맵 관리 유틸리티]
        function getContainerMap(cId) {
            if (cId === "storage") return containerMaps.storage;
            if (cId === "main") return containerMaps.main;
            if (cId && cId.startsWith("bag_")) {
                let slotIdx = parseInt(cId.replace("bag_", ""));
                if (typeof player !== "undefined" && player.equippedBags && player.equippedBags[slotIdx]) {
                    let bagItem = player.equippedBags[slotIdx];
                    let base = ITEM_DB[bagItem.baseId];
                    let rows = (base && base.bagRows) ? base.bagRows : 3;
                    if (!containerMaps[cId] || containerMaps[cId].length !== rows) {
                        containerMaps[cId] = Array.from({ length: rows }, () => Array(INV_COLS).fill(null));
                    }
                    return containerMaps[cId];
                }
            }
            return containerMaps.main;
        }
        // [MOD-020-1-END]
        
        // [MOD-020-3: 배열 회전 유틸리티 함수]
        function getRotatedShape(shape, rot) {
            let s = shape;
            for(let step = 0; step < rot; step++) {
                const rows = s.length;
                const cols = s[0].length;
                let newS = Array.from({length: cols}, () => Array(rows).fill(0));
                for(let r = 0; r < rows; r++) {
                    for(let c = 0; c < cols; c++) {
                        newS[c][rows - 1 - r] = s[r][c]; 
                    }
                }
                s = newS;
            }
            return s;
        }

        let dragItemState = {
            active: false, itemRef: null, ghostEl: null, 
            offsetX: 0, offsetY: 0, origX: 0, origY: 0, 
            isValid: false, currentGridX: 0, currentGridY: 0,
            lastClientX: 0, lastClientY: 0
        };

      
      // [MOD-020-4: 인벤토리/창고 렌더링 및 아이템 상세창 입력 시스템]
      const ITEM_INPUT_CONFIG = {
          holdMs: 250,
          deadzonePx: 10
      };

      let itemDetailTarget = null;
      let itemPressState = null;

      const itemDetailPanel = document.createElement("div");
      itemDetailPanel.id = "itemDetailPanel";
      itemDetailPanel.style.cssText = `
          display:none;
          position:absolute;
          inset:0;
          z-index:60;
          box-sizing:border-box;
          padding:12px;
          overflow-y:auto;
          flex-direction:column;
          gap:8px;
          background:rgba(10,10,15,.97);
          color:white;
          border:1px solid #666;
          border-radius:6px;
      `;

      let itemDetailOpenedTime = 0;

      function closeItemDetail() {
          itemDetailPanel.style.display = "none";
          itemDetailTarget = null;
      }

      // [MOD-020-4-1: 바깥 영역 터치/클릭 시 상세창 닫기]
      document.addEventListener("pointerdown", (e) => {
          if (itemDetailPanel.style.display !== "none" && itemDetailPanel.style.display !== "") {
              // 방금 열린 직후(120ms 이내)의 이벤트는 무시 (클릭으로 열리자마자 바로 닫히는 현상 방지)
              if (Date.now() - itemDetailOpenedTime < 120) return;
              // 상세창 내부를 클릭/터치한 경우 닫지 않음
              if (itemDetailPanel.contains(e.target)) return;
              // 그 외 바깥 영역 터치 시 상세창 닫기
              closeItemDetail();
          }
      }, true);

      function openItemDetail(itemObj, sourceName, slotKey) {
          itemDetailTarget = { itemObj, sourceName, slotKey };
          const baseItem = ITEM_DB[itemObj.baseId];
          if (!baseItem) return;

          

          const typeKor = baseItem.type === "equip"
              ? `[장비 - ${SLOT_HINTS[baseItem.equipSlot] || baseItem.equipSlot}]`
              : baseItem.type === "enchant"
                  ? "[인챈트 두루마리]"
                  : `[${baseItem.type}]`;

          let statHtml = "";
          if (baseItem.stats) {
              for (const key in baseItem.stats) {
                  statHtml += `<div>${key.toUpperCase()}: +${baseItem.stats[key]}</div>`;
              }
          }
          if (!statHtml) {
              statHtml = `<div style="color:#999">능력치 없음</div>`;
          }

          let enchantHtml = "";
          if (itemObj.sockets) {
              const enchants = itemObj.sockets.filter(id => id !== null);
              enchantHtml = enchants.map(sock => {
                  let baseId = typeof sock === "string" ? sock : sock.baseId;
                  let level = (typeof sock === "object" && sock.level) ? sock.level : 1;
                  const data = ITEM_DB[baseId];
                  if (data?.enchantEffect) {
                      let totalVal = data.enchantEffect.value * level;
                      return `<div style="color:#ff8888">- 강타+${level} (${data.enchantEffect.stat}+${totalVal})</div>`;
                  }
                  return "";
              }).join("");

              if (!enchantHtml) {
                  enchantHtml = `<div style="color:#999">빈 소켓 ${itemObj.sockets.length}개</div>`;
              }
          }

          const canUse = ["skillbook", "potion", "consumable"].includes(baseItem.type);

          itemDetailPanel.innerHTML = `
              <div style="font-size:16px;font-weight:bold;color:gold">
                  ${baseItem.name}
              </div>
              <div style="font-size:11px;color:#999">${typeKor}</div>
              <div style="color:#00ffcc;line-height:1.6">${statHtml}</div>
              ${itemObj.sockets ? `
                  <div style="border-top:1px dashed #555;padding-top:8px">
                      <div style="color:#ff8800">[인챈트]</div>
                      ${enchantHtml}
                  </div>` : ""}
              <div style="font-size:12px;line-height:1.6;color:#ddd">
                  ${baseItem.desc || "설명이 없는 아이템입니다."}
              </div>
              <div style="display:flex;gap:8px;margin-top:auto">
                  ${sourceName === "equipment" ? `
                      <button id="itemDetailUnequipBtn" class="btn" style="background:#444;border-color:#888;">해제</button>
                  ` : ""}
                  ${canUse ? `
                      <button id="itemDetailUseBtn" class="btn">사용</button>
                  ` : ""}
                  <button id="itemDetailCloseBtn" class="btn">닫기</button>
              </div>
          `;

          const statSection = document.getElementById("statSection");
          if (!statSection) {
              console.warn("[MOD-020-4] statSection을 찾을 수 없습니다.");
              return;
          }

          if (typeof hideDragStatsPanel === "function") {
              hideDragStatsPanel();
          }

          statSection.appendChild(itemDetailPanel);
          itemDetailPanel.style.display = "flex";
          itemDetailOpenedTime = Date.now();

          document.getElementById("itemDetailCloseBtn")
              .addEventListener("click", closeItemDetail);

          const unequipBtn = document.getElementById("itemDetailUnequipBtn");
          if (unequipBtn) {
              unequipBtn.addEventListener("click", () => {
                  const target = itemDetailTarget;
                  if (!target || !target.slotKey) return;
                  const currentSlot = target.slotKey;
                  let freePos = findFreeSpace(target.itemObj, gridMap);
                  if (freePos) {
                      player.equipment[currentSlot] = null;
                      target.itemObj.gridX = freePos.x;
                      target.itemObj.gridY = freePos.y;
                      myInventoryItems.push(target.itemObj);
                      if (typeof updatePlayerTotalStats === "function") updatePlayerTotalStats();
                      renderGridInventory();
                      closeItemDetail();
                      if (typeof addFloatingText === "function") {
                          addFloatingText(player.x, player.y - 20, "장착 해제됨", "gray");
                      }
                  } else {
                      alert("가방에 빈 공간이 부족하여 장착을 해제할 수 없습니다!");
                  }
              });
          }

          const useButton = document.getElementById("itemDetailUseBtn");
          if (useButton) {
              useButton.addEventListener("click", () => {
                  const target = itemDetailTarget;
                  if (!target) return;

                  const currentBase = ITEM_DB[target.itemObj.baseId];
                  if (!currentBase) return;

                  if (currentBase.type === "skillbook") {
                      closeItemDetail();
                      useSkillBook(target.itemObj, target.sourceName);
                      return;
                  }

                  // 포션/소모품은 기존 사용 함수가 확인될 때 연결
                  if (typeof useItem === "function") {
                      const item = target.itemObj;
                      const source = target.sourceName;
                      useItem(item, source);
                      closeItemDetail();
                  } else {
                      addFloatingText(
                          player.x,
                          player.y - 30,
                          "이 아이템의 사용 기능은 아직 연결되지 않았습니다.",
                          "gray"
                      );
                  }
              });
          }
      }

      function bindItemInput(wrapper, item, sourceName) {
          wrapper.style.touchAction = "none";

          wrapper.addEventListener("mousedown", onDown);
          wrapper.addEventListener("touchstart", onDown, { passive: false });

          function getPoint(e) {
              const p = e.touches?.[0] || e.changedTouches?.[0] || e;
              return { x: p.clientX, y: p.clientY };
          }

          function onDown(e) {
              if (e.type === "mousedown" && e.button !== 0) return;
              if (e.target.closest(".rotate-handle")) return;
              if (itemPressState) return;

              e.preventDefault();

              const point = getPoint(e);
              const state = {
                  item,
                  sourceName,
                  wrapper,
                  startX: point.x,
                  startY: point.y,
                  x: point.x,
                  y: point.y,
                  dragging: false,
                  timer: null,
                  pointerType: e.type === "touchstart" ? "touch" : "mouse"
              };

              itemPressState = state;

              const beginDrag = () => {
                  if (itemPressState !== state || state.dragging) return;

                  state.dragging = true;
                  closeItemDetail();

                  const dragEvent = state.pointerType === "touch"
                      ? {
                          type: "touchstart",
                          touches: [{
                              clientX: state.x,
                              clientY: state.y
                          }],
                          preventDefault() {},
                          stopPropagation() {}
                      }
                      : {
                          type: "mousedown",
                          button: 0,
                          clientX: state.x,
                          clientY: state.y,
                          preventDefault() {},
                          stopPropagation() {}
                      };

                  startDrag(dragEvent, state.item, state.wrapper, state.sourceName);
              };

              state.beginDrag = beginDrag;

              state.timer = setTimeout(() => {
                  beginDrag();
              }, ITEM_INPUT_CONFIG.holdMs);

              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
              document.addEventListener("touchmove", onMove, { passive: false });
              document.addEventListener("touchend", onUp);
              document.addEventListener("touchcancel", onCancel);

              function onMove(ev) {
                  if (itemPressState !== state) return;

                  const p = getPoint(ev);
                  state.x = p.x;
                  state.y = p.y;

                  const distance = Math.hypot(
                      p.x - state.startX,
                      p.y - state.startY
                  );

                  if (distance >= ITEM_INPUT_CONFIG.deadzonePx) {
                      clearTimeout(state.timer);
                      beginDrag();
                  }

                  if (state.dragging && ev.cancelable) {
                      ev.preventDefault();
                  }
              }

              function cleanup() {
                  clearTimeout(state.timer);
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                  document.removeEventListener("touchmove", onMove);
                  document.removeEventListener("touchend", onUp);
                  document.removeEventListener("touchcancel", onCancel);

                  if (itemPressState === state) {
                      itemPressState = null;
                  }
              }

              function onUp() {
                  if (itemPressState !== state) return;

                  clearTimeout(state.timer);

                  if (!state.dragging) {
                      openItemDetail(state.item, state.sourceName);
                  }

                  cleanup();
              }

              function onCancel() {
                  if (itemPressState !== state) return;
                  cleanup();
              }
          }
      }

      // [MOD-020-3: 멀티 보드 그리드 렌더링 시스템]
      function renderBoardGrid(boardId, itemList, mapArray, sourceName, containerId) {
          const board = document.getElementById(boardId);
          if (!board || !mapArray) return;

          board.innerHTML = "";
          const rows = mapArray.length;
          const cols = mapArray[0].length;
          board.style.height = (rows * GRID_CELL_SIZE) + "px";
          if (containerId) board.setAttribute("data-container", containerId);

          for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                  mapArray[r][c] = null;
              }
          }

          itemList.forEach(item => {
              const baseItem = ITEM_DB[item.baseId];
              if (!baseItem) return;

              const shape = getRotatedShape(baseItem.shape, item.rot || 0);
              const h = shape.length;
              const w = shape[0].length;

              for (let r = 0; r < h; r++) {
                  for (let c = 0; c < w; c++) {
                      if (shape[r][c] === 1) {
                          const gy = item.gridY + r;
                          const gx = item.gridX + c;

                          if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
                              mapArray[gy][gx] = item.id || item.uid;
                          }
                      }
                  }
              }

              const wrapper = document.createElement("div");
              wrapper.className = "grid-item-wrapper";
              wrapper.id = item.id || item.uid;
              wrapper.style.width = (w * GRID_CELL_SIZE) + "px";
              wrapper.style.height = (h * GRID_CELL_SIZE) + "px";
              wrapper.style.left = (item.gridX * GRID_CELL_SIZE) + "px";
              wrapper.style.top = (item.gridY * GRID_CELL_SIZE) + "px";

              let labelPlaced = false;

              for (let r = 0; r < h; r++) {
                  for (let c = 0; c < w; c++) {
                      if (shape[r][c] !== 1) continue;

                      const block = document.createElement("div");
                      block.className = "grid-item-block";
                      block.style.width = GRID_CELL_SIZE + "px";
                      block.style.height = GRID_CELL_SIZE + "px";
                      block.style.left = (c * GRID_CELL_SIZE) + "px";
                      block.style.top = (r * GRID_CELL_SIZE) + "px";
                      block.style.backgroundColor = baseItem.color;
                      wrapper.appendChild(block);

                      if (!labelPlaced) {
                          const title = document.createElement("div");
                          title.className = "item-label";
                          title.innerText = baseItem.name;
                          title.style.left = (c * GRID_CELL_SIZE + GRID_CELL_SIZE / 2) + "px";
                          title.style.top = (r * GRID_CELL_SIZE + GRID_CELL_SIZE / 2) + "px";
                          wrapper.appendChild(title);
                          labelPlaced = true;
                      }
                  }
              }

              let handleC = 0;
              for (let c = w - 1; c >= 0; c--) {
                  if (shape[0][c] === 1) {
                      handleC = c;
                      break;
                  }
              }

              const rotateHandle = document.createElement("div");
              rotateHandle.className = "rotate-handle";
              rotateHandle.style.left =
                  (handleC * GRID_CELL_SIZE + GRID_CELL_SIZE - 15) + "px";
              rotateHandle.style.top = "3px";

              const triggerRotate = e => {
                  e.stopPropagation();
                  e.preventDefault();
                  closeItemDetail();
                  attemptRotate(item, wrapper, sourceName, containerId);
              };

              rotateHandle.addEventListener("mousedown", triggerRotate);
              rotateHandle.addEventListener("touchstart", triggerRotate, {
                  passive: false
              });
              wrapper.appendChild(rotateHandle);

              bindItemInput(wrapper, item, sourceName);

              wrapper.addEventListener("contextmenu", e => e.preventDefault());
              wrapper.addEventListener("mouseenter", e => {
                  if (!dragItemState.active) {
                      handleItemMouseEnter(e, item);
                  }
              });
              wrapper.addEventListener("mouseleave", handleItemMouseLeave);
              wrapper.addEventListener("mousemove", handleItemMouseMove);

              board.appendChild(wrapper);
          });
      }

      function useSkillBook(itemObj, sourceName) {
          const baseItem = ITEM_DB[itemObj.baseId];
          if (!baseItem || baseItem.type !== "skillbook") return;

          const skillId = baseItem.skillId;

          if (typeof playerUnlockedSkills !== "undefined" && !playerUnlockedSkills.includes(skillId)) {
              playerUnlockedSkills.push(skillId);
          }

          if (typeof playerAvailableSkills !== "undefined" && !playerAvailableSkills.includes(skillId)) {
              playerAvailableSkills.push(skillId);
          }

          const targetArr = sourceName === "storage" ? personalStorage : myInventoryItems;
          const idx = targetArr.findIndex(i => (i.id || i.uid) === (itemObj.id || itemObj.uid));
          if (idx > -1) {
              targetArr.splice(idx, 1);
          }

          closeItemDetail();
          renderGridInventory();

          if (typeof addFloatingText === "function") {
              addFloatingText(player.x, player.y - 20, "[순간이동] 스킬 습득!", "#00ffcc");
          }

          if (currentRightView === "enchant" &&
              typeof renderSkillUI === "function") {
              renderSkillUI();
          }
      }

      // [상단 5구 가방 슬롯 바 UI 렌더링]
      function renderBagSlotsUI() {
          const bar = document.getElementById("invBagSlotBar");
          if (!bar) return;
          bar.innerHTML = "";

          if (typeof player === "undefined" || !player.equippedBags) {
              if (typeof player !== "undefined") player.equippedBags = [null, null, null, null, null];
              else return;
          }

          for (let i = 0; i < 5; i++) {
              const slotEl = document.createElement("div");
              slotEl.className = "bag-slot";
              slotEl.dataset.slotIndex = i;

              const bagItem = player.equippedBags[i];
              if (bagItem) {
                  slotEl.classList.add("equipped");
                  const baseBag = ITEM_DB[bagItem.baseId];
                  if (baseBag) slotEl.style.backgroundColor = baseBag.color;
                  slotEl.innerHTML = `
                      <div class="bag-slot-label" style="color:white; font-weight:bold;">🎒 ${i + 1}</div>
                      <div class="bag-slot-info">${baseBag ? baseBag.name.replace(" 가방", "") : "가방"}</div>
                  `;
                  slotEl.onmouseenter = (e) => handleItemMouseEnter(e, bagItem);
                  slotEl.onmouseleave = handleItemMouseLeave;
                  slotEl.onmousemove = handleItemMouseMove;

                  slotEl.style.touchAction = "none";
                  slotEl.oncontextmenu = (e) => {
                      e.preventDefault();
                      unequipBag(i);
                  };

                  const onDown = (ev) => {
                      if (ev.type === "mousedown" && ev.button !== 0) return;
                      if (ev.cancelable) ev.preventDefault();

                      const insideItems = myInventoryItems.filter(it => it.container === 'bag_' + i);
                      if (insideItems.length > 0) {
                          if (typeof addFloatingText === "function") {
                              addFloatingText(player.x, player.y - 30, "가방에 아이템이 있어 이동 불가!", "#ff4444");
                          }
                          return;
                      }

                      startDragFromBagSlot(ev, i, bagItem);
                  };

                  slotEl.addEventListener("mousedown", onDown);
                  slotEl.addEventListener("touchstart", onDown, { passive: false });
              } else {
                  slotEl.innerHTML = `
                      <div class="bag-slot-label">🎒 ${i + 1}</div>
                      <div style="font-size: 8px; color: #555;">빈 슬롯</div>
                  `;
              }
              bar.appendChild(slotEl);
          }
      }

      // [전체 그리드 인벤토리 렌더링: 가방 슬롯 + 기본 소지품(8x3) + 장착된 가방 섹션들 + 창고]
      function renderGridInventory() {
          renderEquipSlotsUI();
          renderBagSlotsUI();

          // 1. 기본 소지품 (8x3)
          const mainItems = myInventoryItems.filter(i => (i.container || 'main') === 'main');
          renderBoardGrid(
              "inventoryBoard_main",
              mainItems,
              containerMaps.main,
              "inventory",
              "main"
          );

          // 2. 장착된 가방 섹션들 동적 생성
          const secContainer = document.getElementById("invSectionsContainer");
          if (secContainer) {
              const oldBagSecs = secContainer.querySelectorAll(".inv-section-dynamic-bag");
              oldBagSecs.forEach(el => el.remove());

              if (typeof player !== "undefined" && player.equippedBags) {
                  for (let i = 0; i < 5; i++) {
                      const bagItem = player.equippedBags[i];
                      if (!bagItem) continue;

                      const baseBag = ITEM_DB[bagItem.baseId];
                      if (!baseBag) continue;

                      const cId = 'bag_' + i;
                      const cMap = getContainerMap(cId);

                      const secDiv = document.createElement("div");
                      secDiv.className = "inv-section inv-section-dynamic-bag";
                      secDiv.id = "invSection_bag_" + i;

                      const headerDiv = document.createElement("div");
                      headerDiv.className = "inv-section-header";
                      headerDiv.innerHTML = `
                          <span class="sec-title">🎒 ${i + 1}번 가방: ${baseBag.name} (8 × ${baseBag.bagRows})</span>
                          <span class="sec-badge">${INV_COLS * baseBag.bagRows}칸</span>
                      `;

                      const boardDiv = document.createElement("div");
                      boardDiv.id = "inventoryBoard_bag_" + i;
                      boardDiv.className = "inventory-board";
                      boardDiv.setAttribute("data-container", cId);
                      boardDiv.style.height = (baseBag.bagRows * GRID_CELL_SIZE) + "px";

                      secDiv.appendChild(headerDiv);
                      secDiv.appendChild(boardDiv);
                      secContainer.appendChild(secDiv);

                      const bagItems = myInventoryItems.filter(it => it.container === cId);
                      renderBoardGrid("inventoryBoard_bag_" + i, bagItems, cMap, "inventory", cId);
                  }
              }
          }

          // 3. 개인 창고 (8x10)
          if (gameState === "storage") {
              renderBoardGrid(
                  "storageBoard",
                  personalStorage,
                  containerMaps.storage,
                  "storage",
                  "storage"
              );
          }
      }
      // [MOD-020-4-END]


        // [MOD-020-5: 장비창 UI 렌더링 함수] - 기존 코드 유지 (덮어씌우지 않아도 됨)

        // [MOD-020-6: 비정형 블록 제자리 회전 검사 (멀티 보드 대응)]
        function attemptRotate(itemObj, htmlEl, sourceName, containerId) {
            const baseItem = ITEM_DB[itemObj.baseId];
            let nextRot = ((itemObj.rot || 0) + 1) % 4; 
            const newShape = getRotatedShape(baseItem.shape, nextRot);
            const newH = newShape.length, newW = newShape[0].length;
            let canRotate = true;

            const cId = containerId || itemObj.container || (sourceName === "storage" ? "storage" : "main");
            let targetMap = getContainerMap(cId);
            if (!targetMap) return;

            const maxRows = targetMap.length;
            const maxCols = targetMap[0].length;

            for(let r = 0; r < newH; r++) {
                for(let c = 0; c < newW; c++) {
                    if(newShape[r][c] === 1) {
                        let gy = itemObj.gridY + r, gx = itemObj.gridX + c;
                        if(gy < 0 || gy >= maxRows || gx < 0 || gx >= maxCols) { canRotate = false; break; }
                        if(targetMap[gy][gx] !== null && targetMap[gy][gx] !== (itemObj.id || itemObj.uid)) { canRotate = false; break; }
                    }
                }
                if(!canRotate) break;
            }

            if (canRotate) {
                itemObj.rot = nextRot;
                renderGridInventory(); 
            } else {
                let blocks = htmlEl.querySelectorAll('.grid-item-block');
                blocks.forEach(b => {
                    const originalColor = b.style.backgroundColor;
                    b.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
                    setTimeout(() => { b.style.backgroundColor = originalColor; }, 200);
                });
            }
        }
        // [MOD-020-6-END]

        // [MOD-020-7: 가방 장착/해제 및 드래그 앤 드롭 시스템]
        function showDragStatsPanel(itemObj, source) {}
        function hideDragStatsPanel() {}

        // [가방 착용 로직]
        function equipBag(bagItem, targetSlotIdx, sourceArray, origX, origY, origContainer) {
            if (!bagItem || targetSlotIdx < 0 || targetSlotIdx >= 5) return false;
            const baseBag = ITEM_DB[bagItem.baseId];
            if (!baseBag || baseBag.type !== "bag") return false;

            if (typeof player === "undefined") return false;
            if (!player.equippedBags) player.equippedBags = [null, null, null, null, null];

            const oldBag = player.equippedBags[targetSlotIdx];
            if (oldBag) {
                const insideItems = myInventoryItems.filter(it => it.container === 'bag_' + targetSlotIdx);
                if (insideItems.length > 0) {
                    if (typeof addFloatingText === "function") {
                        addFloatingText(player.x, player.y - 30, "가방에 아이템이 있어 교체 불가!", "#ff4444");
                    } else {
                        alert("교체하려는 가방 안에 아이템이 들어있어 벗을 수 없습니다!");
                    }
                    return false;
                }
            }

            // 소스 배열에서 가방 제거
            if (sourceArray) {
                const idx = sourceArray.findIndex(it => (it.id || it.uid) === (bagItem.id || bagItem.uid));
                if (idx > -1) sourceArray.splice(idx, 1);
            }

            player.equippedBags[targetSlotIdx] = bagItem;
            containerMaps['bag_' + targetSlotIdx] = Array.from({ length: baseBag.bagRows }, () => Array(INV_COLS).fill(null));

            // 기존 가방이 있었으면, 새 가방이 있던 자리(origX, origY) 또는 빈 공간으로 1:1 맞교체
            if (oldBag && sourceArray) {
                const destContainer = origContainer || (sourceArray === personalStorage ? "storage" : "main");
                const targetMap = getContainerMap(destContainer);
                
                if (origX !== undefined && origY !== undefined && targetMap && canPlaceItem(oldBag, origX, origY, targetMap)) {
                    oldBag.gridX = origX;
                    oldBag.gridY = origY;
                    oldBag.container = destContainer;
                    sourceArray.push(oldBag);
                } else {
                    let freePos = findFreeSpace(oldBag, targetMap);
                    if (freePos) {
                        oldBag.gridX = freePos.x;
                        oldBag.gridY = freePos.y;
                        oldBag.container = destContainer;
                        sourceArray.push(oldBag);
                    } else {
                        oldBag.container = "main";
                        oldBag.gridX = 0;
                        oldBag.gridY = 0;
                        myInventoryItems.push(oldBag);
                    }
                }
            }

            if (typeof addFloatingText === "function") {
                addFloatingText(player.x, player.y - 30, "🎒 " + baseBag.name + " 착용!", "#ffd700");
            }

            renderGridInventory();
            return true;
        }

        // [가방 해제 로직]
        function unequipBag(slotIdx) {
            if (slotIdx < 0 || slotIdx >= 5) return false;
            if (typeof player === "undefined" || !player.equippedBags) return false;
            const bagItem = player.equippedBags[slotIdx];
            if (!bagItem) return false;

            const insideItems = myInventoryItems.filter(it => it.container === 'bag_' + slotIdx);
            if (insideItems.length > 0) {
                if (typeof addFloatingText === "function") {
                    addFloatingText(player.x, player.y - 30, "가방에 아이템이 있어 벗을 수 없습니다!", "#ff4444");
                } else {
                    alert("해당 가방에 보관 중인 아이템이 있어 가방을 벗을 수 없습니다! 먼저 가방을 비워주세요.");
                }
                return false;
            }

            // [가방 중첩 방지]: 가방 아이템은 다른 확장 가방(bag_0 등)에 보관 불가. 메인 가방 또는 창고에만 보관 가능
            const candidates = ['main'];
            if (gameState === "storage") candidates.push('storage');

            let placedContainer = null;
            let freePos = null;

            for (let cId of candidates) {
                const cMap = getContainerMap(cId);
                if (cMap) {
                    const pos = findFreeSpace(bagItem, cMap);
                    if (pos) {
                        placedContainer = cId;
                        freePos = pos;
                        break;
                    }
                }
            }

            if (!freePos) {
                if (typeof addFloatingText === "function") {
                    addFloatingText(player.x, player.y - 30, "가방을 넣을 빈 공간 부족!", "#ff4444");
                } else {
                    alert("가방을 보관할 인벤토리 빈 공간이 부족합니다!");
                }
                return false;
            }

            player.equippedBags[slotIdx] = null;
            containerMaps['bag_' + slotIdx] = null;

            bagItem.container = placedContainer;
            bagItem.gridX = freePos.x;
            bagItem.gridY = freePos.y;

            if (placedContainer === "storage") {
                personalStorage.push(bagItem);
            } else {
                myInventoryItems.push(bagItem);
            }

            const baseBag = ITEM_DB[bagItem.baseId];
            if (typeof addFloatingText === "function") {
                addFloatingText(player.x, player.y - 30, "🎒 " + (baseBag ? baseBag.name : "가방") + " 해제", "gray");
            }

            renderGridInventory();
            return true;
        }

        // [인벤토리 UI 화면 배율 정밀 계산 함수]
        function getInventoryScale() {
            const container = typeof document !== 'undefined' ? document.querySelector('.inv-container') : null;
            if (!container) return 1;
            const rect = container.getBoundingClientRect();
            if (container.offsetWidth > 0) {
                return rect.width / container.offsetWidth;
            }
            return 1;
        }

        // [가방 슬롯에서 드래그 시작]
        function startDragFromBagSlot(e, slotIdx, bagItem) {
            const insideItems = myInventoryItems.filter(it => it.container === 'bag_' + slotIdx);
            if (insideItems.length > 0) {
                if (typeof addFloatingText === "function") {
                    addFloatingText(player.x, player.y - 30, "가방에 아이템이 있어 이동 불가!", "#ff4444");
                }
                return;
            }

            dragItemState.active = true;
            dragItemState.itemRef = bagItem;
            dragItemState.origX = -1;
            dragItemState.origY = -1;
            dragItemState.source = "bagSlot";
            dragItemState.sourceBagSlotIdx = slotIdx;
            dragItemState.hoveredEquipSlot = null;
            dragItemState.hoveredBagSlot = null;

            player.equippedBags[slotIdx] = null;
            containerMaps['bag_' + slotIdx] = null;
            renderBagSlotsUI();
            renderGridInventory(); // 가방 해제 즉시 해당 확장 가방 격자판도 화면에서 숨김 처리

            const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
            let clientX = pt.clientX;
            let clientY = pt.clientY;

            const currentScale = getInventoryScale();
            dragItemState.offsetX = GRID_CELL_SIZE / 2;
            dragItemState.offsetY = GRID_CELL_SIZE / 2;
            dragItemState.scale = currentScale;
            dragItemState.lastClientX = clientX;
            dragItemState.lastClientY = clientY;

            let ghost = createGhostDOMForItem(bagItem);
            ghost.className = "grid-item-wrapper dragging";
            ghost.style.position = "fixed";
            ghost.style.transform = `scale(${currentScale})`;
            ghost.style.transformOrigin = "top left";
            ghost.style.pointerEvents = "none";
            ghost.style.zIndex = "99999";
            document.body.appendChild(ghost);
            dragItemState.ghostEl = ghost;

            document.addEventListener("mousemove", onDragMove);
            document.addEventListener("mouseup", onDragEnd);
            document.addEventListener("touchmove", onDragMove, { passive: false });
            document.addEventListener("touchend", onDragEnd);

            updateDragGhost();
        }

        // --- 드래그 로직 ---
        function startDrag(e, itemObj, htmlEl, sourceName) {
            if (e.type === "mousedown" && e.button !== 0) return; 

            dragItemState.active = true;
            dragItemState.itemRef = itemObj;
            dragItemState.origX = itemObj.gridX;
            dragItemState.origY = itemObj.gridY;
            dragItemState.source = sourceName;
            dragItemState.sourceContainer = itemObj.container || (sourceName === "storage" ? "storage" : "main");
            dragItemState.hoveredEquipSlot = null; 
            dragItemState.hoveredBagSlot = null;

            let clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
            let clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

            const currentScale = getInventoryScale();
            const elRect = htmlEl.getBoundingClientRect();
            // [정밀 보정]: 마우스 클릭 지점을 scale 비율로 정확히 역산하여 커서 위치 1:1 고정
            dragItemState.offsetX = (clientX - elRect.left) / currentScale;
            dragItemState.offsetY = (clientY - elRect.top) / currentScale;
            dragItemState.scale = currentScale;
            dragItemState.lastClientX = clientX;
            dragItemState.lastClientY = clientY;

            const baseItem = ITEM_DB[itemObj.baseId];
            const shape = getRotatedShape(baseItem.shape, itemObj.rot || 0);
            const h = shape.length, w = shape[0].length;
            let targetMap = getContainerMap(dragItemState.sourceContainer);
            
            if (targetMap) {
                const maxRows = targetMap.length;
                const maxCols = targetMap[0].length;
                for(let r = 0; r < h; r++) {
                    for(let c = 0; c < w; c++) {
                        if(shape[r][c] === 1) {
                            let gy = itemObj.gridY + r, gx = itemObj.gridX + c;
                            if(gy >= 0 && gy < maxRows && gx >= 0 && gx < maxCols) targetMap[gy][gx] = null;
                        }
                    }
                }
            }

            let ghost = document.createElement("div");
            ghost.className = "grid-item-wrapper dragging"; 
            ghost.style.width = htmlEl.style.width;
            ghost.style.height = htmlEl.style.height;
            ghost.innerHTML = htmlEl.innerHTML; 
            ghost.style.position = "fixed";
            ghost.style.transform = `scale(${currentScale})`;
            ghost.style.transformOrigin = "top left";
            ghost.style.pointerEvents = "none";
            ghost.style.zIndex = "99999";
            
            document.body.appendChild(ghost);
            dragItemState.ghostEl = ghost;
            dragItemState.originalEl = htmlEl;

            document.addEventListener("mousemove", onDragMove);
            document.addEventListener("mouseup", onDragEnd);
            document.addEventListener("touchmove", onDragMove, { passive: false });
            document.addEventListener("touchend", onDragEnd);
            
            updateDragGhost();
        }

        function startDragFromEquip(e, slotName, itemObj) {
            if (e.type === "mousedown" && e.button !== 0) return; 

            dragItemState.active = true;
            dragItemState.itemRef = itemObj;
            dragItemState.origX = -1;
            dragItemState.origY = -1;
            dragItemState.source = "equipment"; 
            dragItemState.sourceSlot = slotName;
            dragItemState.hoveredEquipSlot = null; 
            dragItemState.hoveredBagSlot = null;

            let clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
            let clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

            player.equipment[slotName] = null;
            if (currentEnchantTargetSlot === slotName) clearEnchantRegistration();
            updatePlayerTotalStats();
            renderEquipSlotsUI();

            const currentScale = getInventoryScale();
            dragItemState.offsetX = GRID_CELL_SIZE / 2; 
            dragItemState.offsetY = GRID_CELL_SIZE / 2;
            dragItemState.scale = currentScale;
            dragItemState.lastClientX = clientX;
            dragItemState.lastClientY = clientY;

            let ghost = createGhostDOMForItem(itemObj);
            ghost.className = "grid-item-wrapper dragging"; 
            ghost.style.position = "fixed";
            ghost.style.transform = `scale(${currentScale})`;
            ghost.style.transformOrigin = "top left";
            ghost.style.pointerEvents = "none";
            ghost.style.zIndex = "99999";
            
            document.body.appendChild(ghost);
            dragItemState.ghostEl = ghost;

            document.addEventListener("mousemove", onDragMove);
            document.addEventListener("mouseup", onDragEnd);
            document.addEventListener("touchmove", onDragMove, { passive: false });
            document.addEventListener("touchend", onDragEnd);
            
            updateDragGhost();
        }

        function createGhostDOMForItem(itemObj) {
            const baseItem = ITEM_DB[itemObj.baseId];
            const shape = getRotatedShape(baseItem.shape, itemObj.rot || 0);
            const h = shape.length, w = shape[0].length;
            
            let ghost = document.createElement("div");
            ghost.style.width = (w * GRID_CELL_SIZE) + "px";
            ghost.style.height = (h * GRID_CELL_SIZE) + "px";
            ghost.style.position = "absolute";
            
            let labelPlaced = false;
            for(let r = 0; r < h; r++) {
                for(let c = 0; c < w; c++) {
                    if(shape[r][c] === 1) {
                        let block = document.createElement("div");
                        block.className = "grid-item-block";
                        block.style.width = GRID_CELL_SIZE + "px";
                        block.style.height = GRID_CELL_SIZE + "px";
                        block.style.left = (c * GRID_CELL_SIZE) + "px";
                        block.style.top = (r * GRID_CELL_SIZE) + "px";
                        block.style.backgroundColor = baseItem.color;
                        ghost.appendChild(block);

                        if(!labelPlaced) {
                            let title = document.createElement("div");
                            title.className = "item-label";
                            title.innerText = baseItem.name;
                            title.style.left = (c * GRID_CELL_SIZE + GRID_CELL_SIZE/2) + "px";
                            title.style.top = (r * GRID_CELL_SIZE + GRID_CELL_SIZE/2) + "px";
                            ghost.appendChild(title);
                            labelPlaced = true;
                        }
                    }
                }
            }
            return ghost;
        }

        function onDragMove(e) {
            if (!dragItemState.active) return;
            if (e.cancelable) e.preventDefault();
            
            if (dragItemState.originalEl) {
                dragItemState.originalEl.style.display = "none";
                dragItemState.originalEl = null;
            }

            if(e.type === "touchmove" && e.touches.length > 0) {
                dragItemState.lastClientX = e.touches[0].clientX;
                dragItemState.lastClientY = e.touches[0].clientY;
            } else if(e.type === "mousemove") {
                dragItemState.lastClientX = e.clientX;
                dragItemState.lastClientY = e.clientY;
            }
            updateDragGhost();
        }

        function updateDragGhost() {
            if(!dragItemState.ghostEl) return;

            const currentScale = getInventoryScale();
            dragItemState.scale = currentScale;

            // [고스트 위치 고정]: 마우스 클릭 지점과 고스트의 위치를 1:1로 항상 일치시킴
            dragItemState.ghostEl.style.position = "fixed";
            dragItemState.ghostEl.style.transform = `scale(${currentScale})`;
            dragItemState.ghostEl.style.transformOrigin = "top left";
            dragItemState.ghostEl.style.left = (dragItemState.lastClientX - dragItemState.offsetX * currentScale) + "px";
            dragItemState.ghostEl.style.top = (dragItemState.lastClientY - dragItemState.offsetY * currentScale) + "px";

            // 마우스 아래에 위치한 .inventory-board 요소 찾기
            const allBoards = document.querySelectorAll('.inventory-board');
            let targetBoardDOM = null;
            let targetContainerName = null;
            let targetMap = null;
            let targetRect = null;

            for (let bEl of allBoards) {
                if (bEl.offsetParent === null) continue;
                const r = bEl.getBoundingClientRect();
                if (dragItemState.lastClientX >= r.left && dragItemState.lastClientX <= r.right &&
                    dragItemState.lastClientY >= r.top && dragItemState.lastClientY <= r.bottom) {
                    targetBoardDOM = bEl;
                    targetContainerName = bEl.getAttribute("data-container") || "main";
                    targetMap = getContainerMap(targetContainerName);
                    targetRect = r;
                    break;
                }
            }

            dragItemState.targetBoard = targetBoardDOM ? (targetContainerName === "storage" ? "storage" : "inventory") : null;
            dragItemState.targetContainer = targetContainerName;
            let rawGridX = 0, rawGridY = 0;

            if (targetBoardDOM && targetMap) {
                // [정밀 보정]: 보드 내부 격자 위치를 스케일 비율로 역산
                let localX = (dragItemState.lastClientX - targetRect.left) / currentScale - dragItemState.offsetX;
                let localY = (dragItemState.lastClientY - targetRect.top) / currentScale - dragItemState.offsetY;

                rawGridX = Math.round(localX / GRID_CELL_SIZE);
                rawGridY = Math.round(localY / GRID_CELL_SIZE);

                dragItemState.currentGridX = rawGridX;
                dragItemState.currentGridY = rawGridY;
                dragItemState.isValid = true;

                const baseItem = ITEM_DB[dragItemState.itemRef.baseId];
                const shape = getRotatedShape(baseItem.shape, dragItemState.itemRef.rot || 0);
                const h = shape.length, w = shape[0].length;
                const maxRows = targetMap.length;
                const maxCols = targetMap[0].length;

                // [가방 중첩 및 자기 주머니 보관 차단]: 가방 아이템은 확장 가방(bag_0 ~ bag_4)에 보관 불가
                if (baseItem.type === "bag" && targetContainerName && targetContainerName.startsWith("bag_")) {
                    dragItemState.isValid = false;
                }
                // 가방 슬롯에서 드래그 중인 가방은 원래 자신이 제공하던 가방 주머니에 절대 드롭 불가
                if (dragItemState.source === "bagSlot" && targetContainerName === ('bag_' + dragItemState.sourceBagSlotIdx)) {
                    dragItemState.isValid = false;
                }

                for(let r = 0; r < h; r++) {
                    for(let c = 0; c < w; c++) {
                        if(shape[r][c] === 1) {
                            let gy = rawGridY + r, gx = rawGridX + c;
                            if (gy < 0 || gy >= maxRows || gx < 0 || gx >= maxCols) { dragItemState.isValid = false; break; }
                            if (targetMap[gy][gx] !== null) { dragItemState.isValid = false; }
                        }
                    }
                }
            } else {
                dragItemState.isValid = false;
            }

            // [가방 슬롯 호버 검사]
            dragItemState.hoveredBagSlot = null;
            const baseItem = ITEM_DB[dragItemState.itemRef.baseId];
            if (baseItem && baseItem.type === "bag") {
                document.querySelectorAll('.bag-slot').forEach(slot => {
                    const slotRect = slot.getBoundingClientRect();
                    const isOver = dragItemState.lastClientX >= slotRect.left && dragItemState.lastClientX <= slotRect.right &&
                                   dragItemState.lastClientY >= slotRect.top && dragItemState.lastClientY <= slotRect.bottom;
                    if (isOver) {
                        slot.style.boxShadow = "0 0 15px gold";
                        slot.style.borderColor = "gold";
                        slot.style.transform = "scale(1.08)";
                        dragItemState.hoveredBagSlot = slot;
                    } else {
                        slot.style.boxShadow = "";
                        slot.style.borderColor = "";
                        slot.style.transform = "scale(1.0)";
                    }
                });
            }

            // [장비 슬롯 호버 검사]
            dragItemState.hoveredEquipSlot = null; 
            const ghostRect = dragItemState.ghostEl.getBoundingClientRect();
            
            document.querySelectorAll('.equip-slot').forEach(slot => {
                const slotRect = slot.getBoundingClientRect();
                const isOverlapping = !(ghostRect.right < slotRect.left || ghostRect.left > slotRect.right || ghostRect.bottom < slotRect.top || ghostRect.top > slotRect.bottom);
                
                if (isOverlapping && baseItem.type === "equip" && baseItem.equipSlot === slot.getAttribute('data-slot')) {
                    slot.style.boxShadow = "0 0 15px gold"; 
                    slot.style.borderColor = "gold"; 
                    slot.style.transform = "scale(1.1)"; 
                    dragItemState.hoveredEquipSlot = slot; 
                } else {
                    slot.style.boxShadow = ""; 
                    slot.style.borderColor = ""; 
                    slot.style.transform = "scale(1.0)";
                }
            });

            const isAcceptable = dragItemState.isValid || (dragItemState.hoveredEquipSlot !== null) || (dragItemState.hoveredBagSlot !== null);
            let blocks = dragItemState.ghostEl.querySelectorAll('.grid-item-block');
            blocks.forEach(b => {
                b.style.backgroundColor = isAcceptable ? "rgba(0, 255, 0, 0.5)" : "rgba(255, 0, 0, 0.5)";
                b.style.border = isAcceptable ? "2px solid #0f0" : "2px solid #f00";
            });
        }

        function onDragEnd(e) {
            if (!dragItemState.active) return;
            document.removeEventListener("mousemove", onDragMove);
            document.removeEventListener("mouseup", onDragEnd);
            document.removeEventListener("touchmove", onDragMove);
            document.removeEventListener("touchend", onDragEnd);

            hideDragStatsPanel();

            let sourceArray = dragItemState.source === "storage" ? personalStorage : myInventoryItems;

            // 1. 가방 슬롯에 장착 / 가방 슬롯 간 이동 및 맞바꾸기(SWAP)
            if (dragItemState.hoveredBagSlot) {
                const targetSlotIdx = parseInt(dragItemState.hoveredBagSlot.dataset.slotIndex);

                // [케이스 1]: 가방 슬롯에서 드래그하여 다른 가방 슬롯으로 놓은 경우 (슬롯 간 이동 / 맞바꾸기)
                if (dragItemState.source === "bagSlot") {
                    const fromSlotIdx = dragItemState.sourceBagSlotIdx;
                    const fromBag = dragItemState.itemRef;
                    const targetOldBag = player.equippedBags[targetSlotIdx];

                    if (fromSlotIdx === targetSlotIdx) {
                        // 같은 슬롯 제자리 드롭: 원래 자리로 복원
                        player.equippedBags[fromSlotIdx] = fromBag;
                        containerMaps['bag_' + fromSlotIdx] = Array.from({ length: ITEM_DB[fromBag.baseId].bagRows }, () => Array(INV_COLS).fill(null));
                    } else if (!targetOldBag) {
                        // 대상 슬롯이 빈 슬롯인 경우: 슬롯 이동 및 내부 아이템 컨테이너 ID 변경
                        myInventoryItems.forEach(it => {
                            if (it.container === 'bag_' + fromSlotIdx) {
                                it.container = 'bag_' + targetSlotIdx;
                            }
                        });
                        player.equippedBags[targetSlotIdx] = fromBag;
                        containerMaps['bag_' + targetSlotIdx] = Array.from({ length: ITEM_DB[fromBag.baseId].bagRows }, () => Array(INV_COLS).fill(null));
                        player.equippedBags[fromSlotIdx] = null;
                        containerMaps['bag_' + fromSlotIdx] = null;
                        if (typeof addFloatingText === "function") {
                            addFloatingText(player.x, player.y - 30, "🎒 가방 슬롯 이동 완료!", "#ffd700");
                        }
                    } else {
                        // 대상 슬롯에 이미 가방이 있는 경우: 위치 맞바꾸기 (SWAP)
                        const fromInside = myInventoryItems.filter(it => it.container === 'bag_' + fromSlotIdx);
                        const targetInside = myInventoryItems.filter(it => it.container === 'bag_' + targetSlotIdx);

                        if (fromInside.length > 0 || targetInside.length > 0) {
                            // 크기 차이로 인한 아이템 유실을 방지하기 위해 둘 중 하나라도 차있으면 스왑 금지 후 안전 복귀
                            player.equippedBags[fromSlotIdx] = fromBag;
                            containerMaps['bag_' + fromSlotIdx] = Array.from({ length: ITEM_DB[fromBag.baseId].bagRows }, () => Array(INV_COLS).fill(null));
                            if (typeof addFloatingText === "function") {
                                addFloatingText(player.x, player.y - 30, "가방에 아이템이 있어 맞바꿀 수 없습니다!", "#ff4444");
                            } else {
                                alert("가방에 아이템이 보관되어 있어 위치를 맞바꿀 수 없습니다! 가방을 비운 후 교체해주세요.");
                            }
                        } else {
                            // 둘 다 비어있으므로 안전하게 위치 맞바꾸기 (SWAP)
                            player.equippedBags[targetSlotIdx] = fromBag;
                            player.equippedBags[fromSlotIdx] = targetOldBag;
                            containerMaps['bag_' + targetSlotIdx] = Array.from({ length: ITEM_DB[fromBag.baseId].bagRows }, () => Array(INV_COLS).fill(null));
                            containerMaps['bag_' + fromSlotIdx] = Array.from({ length: ITEM_DB[targetOldBag.baseId].bagRows }, () => Array(INV_COLS).fill(null));
                            if (typeof addFloatingText === "function") {
                                addFloatingText(player.x, player.y - 30, "🎒 가방 위치 맞교환 완료!", "#ffd700");
                            }
                        }
                    }
                    renderBagSlotsUI();
                    renderGridInventory();
                } 
                // [케이스 2]: 인벤토리나 창고에서 가방 슬롯으로 드래그하여 장착하는 경우
                else {
                    const success = equipBag(dragItemState.itemRef, targetSlotIdx, sourceArray, dragItemState.origX, dragItemState.origY, dragItemState.sourceContainer);
                    if (!success) {
                        // 실패 시 (기존 가방에 아이템이 있어서 교체 불가 등): 원래 인벤토리/창고 자리로 안전 복구
                        dragItemState.itemRef.gridX = dragItemState.origX;
                        dragItemState.itemRef.gridY = dragItemState.origY;
                        dragItemState.itemRef.container = dragItemState.sourceContainer || "main";
                        renderGridInventory();
                    }
                }
            }
            // 2. 일반 장비 슬롯에 장착
            else if (dragItemState.hoveredEquipSlot) {
                let targetSlotName = dragItemState.hoveredEquipSlot.getAttribute('data-slot');
                let baseItem = ITEM_DB[dragItemState.itemRef.baseId];
                
                if (baseItem.type === "equip" && baseItem.equipSlot === targetSlotName) {
                    let oldItem = player.equipment[targetSlotName];
                    let canSwap = true;

                    if (oldItem) {
                        let targetMap = getContainerMap(dragItemState.sourceContainer || "main");
                        let targetArr = dragItemState.source === "storage" ? personalStorage : myInventoryItems;
                        
                        if (dragItemState.source === "equipment") {
                            canSwap = false; 
                        } else if (canPlaceItem(oldItem, dragItemState.origX, dragItemState.origY, targetMap)) {
                            oldItem.gridX = dragItemState.origX;
                            oldItem.gridY = dragItemState.origY;
                            oldItem.container = dragItemState.sourceContainer || "main";
                            targetArr.push(oldItem);
                        } else {
                            let freePos = findFreeSpace(oldItem, targetMap);
                            if (freePos) {
                                oldItem.gridX = freePos.x;
                                oldItem.gridY = freePos.y;
                                oldItem.container = dragItemState.sourceContainer || "main";
                                targetArr.push(oldItem);
                            } else {
                                alert("기존 장비를 해제할 빈 공간이 부족합니다!");
                                canSwap = false;
                            }
                        }
                    }

                    if (canSwap) {
                        if (dragItemState.source !== "equipment" && dragItemState.source !== "bagSlot") {
                            let idx = sourceArray.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                            if(idx > -1) sourceArray.splice(idx, 1);
                        }
                        if(!dragItemState.itemRef.sockets) dragItemState.itemRef.sockets = Array(baseItem.maxSockets || 0).fill(null);
                        
                        player.equipment[targetSlotName] = dragItemState.itemRef;
                        updatePlayerTotalStats();
                        renderEquipSlotsUI();
                        if (currentRightView === 'enchant') selectEquipSlotForEnchant(SLOT_HINTS[targetSlotName], targetSlotName);
                    }
                }
            } 
            // 3. 보드에 적치
            else if (dragItemState.isValid && dragItemState.targetContainer) {
                const targetCId = dragItemState.targetContainer;
                const baseItem = ITEM_DB[dragItemState.itemRef.baseId];

                // [최종 안전 방어]: 가방 아이템이 확장 가방(bag_)으로 적치되는 것을 원천 차단
                if (baseItem && baseItem.type === "bag" && targetCId.startsWith("bag_")) {
                    if (dragItemState.source === "bagSlot") {
                        player.equippedBags[dragItemState.sourceBagSlotIdx] = dragItemState.itemRef;
                        containerMaps['bag_' + dragItemState.sourceBagSlotIdx] = Array.from({ length: baseItem.bagRows }, () => Array(INV_COLS).fill(null));
                    } else {
                        dragItemState.itemRef.gridX = dragItemState.origX;
                        dragItemState.itemRef.gridY = dragItemState.origY;
                        dragItemState.itemRef.container = dragItemState.sourceContainer || "main";
                    }
                    if (typeof addFloatingText === "function") {
                        addFloatingText(player.x, player.y - 30, "가방은 확장 가방에 보관할 수 없습니다!", "#ff4444");
                    }
                } else {
                    const targetArr = targetCId === "storage" ? personalStorage : myInventoryItems;

                    dragItemState.itemRef.container = targetCId;
                    dragItemState.itemRef.gridX = dragItemState.currentGridX;
                    dragItemState.itemRef.gridY = dragItemState.currentGridY;

                    if (dragItemState.source === "equipment") {
                        targetArr.push(dragItemState.itemRef);
                        updatePlayerTotalStats();
                        renderEquipSlotsUI();
                    } else if (dragItemState.source === "bagSlot") {
                        targetArr.push(dragItemState.itemRef);
                    } else if (dragItemState.source === "storage" && targetCId !== "storage") {
                        let idx = personalStorage.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                        if (idx > -1) personalStorage.splice(idx, 1);
                        myInventoryItems.push(dragItemState.itemRef);
                    } else if (dragItemState.source !== "storage" && targetCId === "storage") {
                        let idx = myInventoryItems.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                        if (idx > -1) myInventoryItems.splice(idx, 1);
                        personalStorage.push(dragItemState.itemRef);
                    }
                }
            } 
            // 4. 인벤토리/창고 UI 바깥으로 드래그하여 놓았을 때 -> 바닥에 버리기!
            else {
                const invContainer = document.querySelector('.inv-container');
                const stoPanel = document.getElementById('storagePanel');
                const invRect = invContainer ? invContainer.getBoundingClientRect() : null;
                const stoRect = (stoPanel && gameState === "storage") ? stoPanel.getBoundingClientRect() : null;

                const isInsideUI = (invRect && dragItemState.lastClientX >= invRect.left && dragItemState.lastClientX <= invRect.right &&
                                              dragItemState.lastClientY >= invRect.top && dragItemState.lastClientY <= invRect.bottom) ||
                                   (stoRect && dragItemState.lastClientX >= stoRect.left && dragItemState.lastClientX <= stoRect.right &&
                                              dragItemState.lastClientY >= stoRect.top && dragItemState.lastClientY <= stoRect.bottom);

                if (!isInsideUI) {
                    // [바닥에 버리기]
                    const dropDist = 35;
                    const dropAngle = Math.random() * Math.PI * 2;
                    let dropX = Math.max(50, Math.min(typeof WORLD_WIDTH !== "undefined" ? WORLD_WIDTH - 50 : 1950, player.x + Math.cos(dropAngle) * dropDist));
                    let dropY = Math.max(50, Math.min(typeof WORLD_HEIGHT !== "undefined" ? WORLD_HEIGHT - 50 : 1950, player.y + Math.sin(dropAngle) * dropDist));

                    if (typeof fieldItems !== "undefined") {
                        fieldItems.push({
                            id: dragItemState.itemRef.id || ("field_" + Date.now()),
                            baseId: dragItemState.itemRef.baseId,
                            rot: dragItemState.itemRef.rot || 0,
                            sockets: dragItemState.itemRef.sockets ? [...dragItemState.itemRef.sockets] : null,
                            x: dropX,
                            y: dropY,
                            pickupDelay: 60, // 바로 주워지지 않도록 딜레이
                            errorFlashTimer: 0
                        });
                    }

                    if (dragItemState.source === "inventory" || dragItemState.source === "bagSlot") {
                        let idx = myInventoryItems.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                        if (idx > -1) myInventoryItems.splice(idx, 1);
                    } else if (dragItemState.source === "storage") {
                        let idx = personalStorage.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                        if (idx > -1) personalStorage.splice(idx, 1);
                    } else if (dragItemState.source === "equipment") {
                        updatePlayerTotalStats();
                        renderEquipSlotsUI();
                    }

                    const baseItem = ITEM_DB[dragItemState.itemRef.baseId];
                    if (typeof addFloatingText === "function") {
                        addFloatingText(player.x, player.y - 30, (baseItem ? baseItem.name : "아이템") + " 버림", "gray");
                    }
                } else {
                    // UI 내부이지만 유효하지 않은 칸 -> 원복
                    if (dragItemState.source === "equipment") {
                        player.equipment[dragItemState.sourceSlot] = dragItemState.itemRef;
                        updatePlayerTotalStats();
                        renderEquipSlotsUI();
                    } else if (dragItemState.source === "bagSlot") {
                        // 유효한 그리드 칸이 아닌 곳에 놓았을 때: 인벤토리 빈 공간에 자동 적치 시도
                        const candidates = ['main'];
                        if (gameState === "storage") candidates.push('storage');
                        let freePos = null;
                        let targetC = 'main';
                        for (let cId of candidates) {
                            const cMap = getContainerMap(cId);
                            if (cMap) {
                                const pos = findFreeSpace(dragItemState.itemRef, cMap);
                                if (pos) { freePos = pos; targetC = cId; break; }
                            }
                        }
                        if (freePos) {
                            dragItemState.itemRef.container = targetC;
                            dragItemState.itemRef.gridX = freePos.x;
                            dragItemState.itemRef.gridY = freePos.y;
                            const targetArr = targetC === "storage" ? personalStorage : myInventoryItems;
                            targetArr.push(dragItemState.itemRef);
                        } else {
                            // 빈 공간이 없으면 원래 슬롯으로 원복
                            player.equippedBags[dragItemState.sourceBagSlotIdx] = dragItemState.itemRef;
                            containerMaps['bag_' + dragItemState.sourceBagSlotIdx] = Array.from({ length: ITEM_DB[dragItemState.itemRef.baseId].bagRows }, () => Array(INV_COLS).fill(null));
                            if (typeof addFloatingText === "function") {
                                addFloatingText(player.x, player.y - 30, "인벤토리에 빈 공간이 없습니다!", "#ff4444");
                            }
                        }
                    } else {
                        dragItemState.itemRef.gridX = dragItemState.origX;
                        dragItemState.itemRef.gridY = dragItemState.origY;
                        dragItemState.itemRef.container = dragItemState.sourceContainer || "main";
                    }
                }
            }

            dragItemState.active = false;
            if(dragItemState.ghostEl) {
                dragItemState.ghostEl.remove(); 
                dragItemState.ghostEl = null;
            }
            renderGridInventory();
        }
        // [MOD-020-7-END]

        // [격자 적치 판정 및 빈 공간 탐색 유틸리티]
        function canPlaceItem(itemObj, gridX, gridY, map) {
            if (!map || !map.length) return false;
            const maxRows = map.length;
            const maxCols = map[0].length;
            const baseItem = ITEM_DB[itemObj.baseId];
            if (!baseItem) return false;
            const shape = getRotatedShape(baseItem.shape, itemObj.rot || 0);
            const h = shape.length, w = shape[0].length;
            for(let r=0; r<h; r++){
                for(let c=0; c<w; c++){
                    if(shape[r][c] === 1){
                        let gy = gridY + r, gx = gridX + c;
                        if(gy < 0 || gy >= maxRows || gx < 0 || gx >= maxCols) return false;
                        if(map[gy][gx] !== null && map[gy][gx] !== (itemObj.id || itemObj.uid)) return false;
                    }
                }
            }
            return true;
        }

        function findFreeSpace(itemObj, map) {
            if (!map || !map.length) return null;
            const maxRows = map.length;
            const maxCols = map[0].length;
            for(let y=0; y<maxRows; y++){
                for(let x=0; x<maxCols; x++){
                    if(canPlaceItem(itemObj, x, y, map)) return {x, y};
                }
            }
            return null;
        }

        // [바닥 아이템 습득 시스템]
        let lastPickupTime = 0;
        function pickupFieldItem(fItem) {
            if (!fItem) return;
            if (typeof player === "undefined") return;

            // 1. 거리 검사 (80px 이내)
            const dist = Math.hypot(fItem.x - player.x, fItem.y - player.y);
            if (dist > 80) {
                if (typeof addFloatingText === "function") {
                    addFloatingText(fItem.x, fItem.y - 20, "너무 멉니다", "orange");
                }
                return;
            }

            // 2. 줍기 딜레이 (0.25초)
            const now = Date.now();
            if (now - lastPickupTime < 250) return;
            lastPickupTime = now;

            const baseItem = ITEM_DB[fItem.baseId];
            if (!baseItem) return;

            // 3. 적치 가능한 컨테이너 순회 탐색 (1순위: main 8x3, 2순위: 1번~5번 가방)
            // [가방 중첩 방지]: 가방 아이템은 주울 때도 확장 가방에 들어가지 않고 메인에만 적치
            const candidates = ['main'];
            if (player.equippedBags && baseItem.type !== "bag") {
                for (let i = 0; i < 5; i++) {
                    if (player.equippedBags[i]) candidates.push('bag_' + i);
                }
            }

            let placedContainer = null;
            let freePos = null;

            for (let cId of candidates) {
                const cMap = getContainerMap(cId);
                if (cMap) {
                    const pos = findFreeSpace({ baseId: fItem.baseId, rot: fItem.rot || 0 }, cMap);
                    if (pos) {
                        placedContainer = cId;
                        freePos = pos;
                        break;
                    }
                }
            }

            // 4. 공간 부족
            if (!freePos) {
                fItem.errorFlashTimer = 30;
                if (typeof addFloatingText === "function") {
                    addFloatingText(player.x, player.y - 30, "인벤토리 공간 부족!", "#ff3333");
                }
                return;
            }

            // 5. 습득 성공
            if (typeof fieldItems !== "undefined") {
                const idx = fieldItems.indexOf(fItem);
                if (idx > -1) fieldItems.splice(idx, 1);
            }
            if (typeof targetedFieldItem !== "undefined" && targetedFieldItem === fItem) {
                targetedFieldItem = null;
            }

            const newItem = {
                id: fItem.id || ("item_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
                baseId: fItem.baseId,
                rot: fItem.rot || 0,
                container: placedContainer,
                gridX: freePos.x,
                gridY: freePos.y,
                sockets: fItem.sockets || Array(baseItem.maxSockets || 0).fill(null)
            };

            myInventoryItems.push(newItem);
            renderGridInventory();

            if (typeof addFloatingText === "function") {
                addFloatingText(player.x, player.y - 30, "+ " + baseItem.name, "#00ff88");
            }
        }

// [개인 창고 오픈 인터페이스]
        function openStorage() {
            gameState = "storage";
            document.getElementById("inventoryUI").style.display = "flex";
            
            // 개인 창고 패널 화면에 노출
            const sp = document.getElementById("storagePanel");
            if (sp) sp.style.display = "flex";
            
            // 창고가 열려있는 동안에는 방해되지 않게 조작 패드/퀵슬롯 가리기
            const vpad = document.getElementById("vpad-container");
            if (vpad) vpad.style.display = "none";
            
            // 만약 우측 패널이 인챈트 창으로 켜져있다면, 창고를 열 때 가방 뷰로 강제 원복
            if (typeof currentRightView !== 'undefined' && currentRightView === 'enchant') {
                toggleRightPanelView(); 
            } else {
                if (typeof renderGridInventory === "function") renderGridInventory();
                if (typeof autoScaleInventory === "function") autoScaleInventory();
            }
            if (typeof updateNotiBadges === "function") updateNotiBadges();
        }
