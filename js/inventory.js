
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
            enchants.forEach(sId => {
                if (ITEM_DB[sId] && ITEM_DB[sId].enchantEffect) {
                    enchantHtml += `<div class='item-tooltip-enchant-item'>- ${ITEM_DB[sId].enchantEffect.name}</div>`;
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

            let allScrolls = [...myInventoryItems];
            if (gameState === "storage") {
                allScrolls = allScrolls.concat(personalStorage);
            }
            let hasScroll = allScrolls.some(i => ITEM_DB[i.baseId] && ITEM_DB[i.baseId].type === "enchant");
            
            let foundFirstEmpty = false;
            let socketsHtml = '';
            
            for(let i = 0; i < baseItem.maxSockets; i++) {
                let scrollId = item.sockets[i];
                if(scrollId) {
                    let effect = ITEM_DB[scrollId].enchantEffect;
                    socketsHtml += `<div class="socket-slot socket-animated" style="background:#ff4444; border-color:white; position:relative;">
                        <span style="font-size:9px; color:#fff; font-weight:bold;">${effect.stat}+${effect.value}</span>
                    </div>`;
                } else if (pendingEnchant && pendingEnchant.slotKey === slotKey && pendingEnchant.socketIndex === i) {
                    let pScroll = myInventoryItems.find(x => (x.id||x.uid) === pendingEnchant.scrollId) || personalStorage.find(x => (x.id||x.uid) === pendingEnchant.scrollId);
                    if (pScroll) {
                        let effect = ITEM_DB[pScroll.baseId].enchantEffect;
                        socketsHtml += `<div class="socket-slot socket-animated" style="background:#ff8800; border:2px dashed gold; animation: pulse-noti 1.2s infinite; position:relative;">
                            <span style="font-size:9px; color:#fff; font-weight:bold;">${effect.stat}+${effect.value}</span>
                        </div>`;
                    }
                } else {
                    let badgeHtml = "";
                    if (!foundFirstEmpty && hasScroll && !pendingEnchant) {
                        badgeHtml = `<div class="noti-badge socket-badge">!</div>`;
                        foundFirstEmpty = true; 
                    }
                    socketsHtml += `<div class="socket-slot socket-animated" style="position:relative;" onclick="openEnchantPopup('${slotKey}', ${i})">${badgeHtml}</div>`;
                }
            }

            let confirmUI = '';
            if (pendingEnchant && pendingEnchant.slotKey === slotKey) {
                confirmUI = `
                    <div style="display:flex; gap:10px; justify-content:center; margin-top: 6px; position:relative; z-index:10;">
                        <button style="padding:7px 20px; background:limegreen; border:2px solid white; color:white; font-weight:bold; border-radius:4px; cursor:pointer;" onclick="confirmPendingEnchant()">확정</button>
                        <button style="padding:7px 20px; background:gray; border:2px solid white; color:white; font-weight:bold; border-radius:4px; cursor:pointer;" onclick="cancelPendingEnchant('${slotNameKOR}', '${slotKey}')">취소</button>
                    </div>
                `;
            } else {
                confirmUI = `<div style="font-size: 11px; color: #888; text-align: center;">빈 소켓을 클릭하면<br>인챈트 북 목록이 표시됩니다.</div>`;
            }

            content.innerHTML = `
                <div style="display: flex; gap: 14px; justify-content: center; align-items: center; margin-bottom: 12px;">
                    ${socketsHtml}
                </div>
                ${confirmUI}
            `;
            
            setTimeout(updateNotiBadges, 10); 
        }

        function openEnchantPopup(slotKey, socketIndex) {
            let allScrolls = [...myInventoryItems];
            if (gameState === "storage") {
                allScrolls = allScrolls.concat(personalStorage);
            }

            let scrolls = allScrolls.filter(i => ITEM_DB[i.baseId] && ITEM_DB[i.baseId].type === "enchant");
            let popup = document.getElementById("enchantPopupUI");
            
            if(scrolls.length === 0) {
                popup.innerHTML = `<div style="color:gray; font-size:11px; text-align:center;">사용 가능한<br>인챈트 두루마리가 없습니다.</div>
                <button onclick="document.getElementById('enchantPopupUI').style.display='none'" style="margin-top:10px; background:#444; color:#fff; border:none; padding:5px; border-radius:4px;">닫기</button>`;
            } else {
                let listHtml = scrolls.map(scroll => {
                    let base = ITEM_DB[scroll.baseId];
                    let sourceText = myInventoryItems.some(i => (i.id || i.uid) === (scroll.id || scroll.uid)) ? "가방" : "창고";
                    return `<div class="enchant-scroll-item" onclick="stageEnchant('${slotKey}', ${socketIndex}, '${scroll.id || scroll.uid}')">
                        <span style="color:#aaa; font-size:9px;">[${sourceText}]</span> ${base.name} <span style="color:gold; font-size:10px;">${base.enchantEffect.name}</span>
                    </div>`;
                }).join('');
                
                popup.innerHTML = `<div style="color:gold; font-weight:bold; font-size:12px; margin-bottom:10px; text-align:center;">인챈트 선택</div>
                ${listHtml}
                <button onclick="document.getElementById('enchantPopupUI').style.display='none'" style="margin-top:10px; background:#444; color:#fff; border:none; padding:5px; border-radius:4px;">취소</button>`;
            }
            popup.style.display = 'flex';
        }

        function stageEnchant(slotKey, socketIndex, scrollId) {
            pendingEnchant = { slotKey, socketIndex, scrollId };
            document.getElementById('enchantPopupUI').style.display = 'none';
            let slotNameKOR = document.querySelector(`[data-slot="${slotKey}"]`).innerText;
            selectEquipSlotForEnchant(slotNameKOR, slotKey); 
        }

        function confirmPendingEnchant() {
            if(!pendingEnchant) return;
            let slotKey = pendingEnchant.slotKey;
            let socketIndex = pendingEnchant.socketIndex;
            let scrollId = pendingEnchant.scrollId;
            
            let item = player.equipment[slotKey];
            let scroll = null;
            
            let invIdx = myInventoryItems.findIndex(i => (i.id || i.uid) === scrollId);
            if (invIdx > -1) {
                scroll = myInventoryItems.splice(invIdx, 1)[0];
            } else if (gameState === "storage") {
                let stoIdx = personalStorage.findIndex(i => (i.id || i.uid) === scrollId);
                if (stoIdx > -1) {
                    scroll = personalStorage.splice(stoIdx, 1)[0];
                    if (typeof renderGridInventory === "function") renderGridInventory();
                }
            }
            
            if (scroll) {
                item.sockets[socketIndex] = scroll.baseId;
            }
            
            pendingEnchant = null;
            updatePlayerTotalStats();
            
            let slotNameKOR = document.querySelector(`[data-slot="${slotKey}"]`).innerText;
            selectEquipSlotForEnchant(slotNameKOR, slotKey); 
        }

        function cancelPendingEnchant(slotNameKOR, slotKey) {
            pendingEnchant = null;
            selectEquipSlotForEnchant(slotNameKOR, slotKey);
        }


// [MOD-020: 그리드 인벤토리 코어 시스템]
// [MOD-020-1: 그리드 환경 변수 및 장비 슬롯 정의]
        const GRID_CELL_SIZE = 40; 
        const INV_COLS = 8;        
        const INV_ROWS = 10;       
        
        let gridMap = Array.from({ length: INV_ROWS }, () => Array(INV_COLS).fill(null));
        let storageMap = Array.from({ length: INV_ROWS }, () => Array(INV_COLS).fill(null)); 
        
        let equipmentSlots = {
            helmet: null,   
            armor: "item_2",    
            weapon: "item_1",   
            accessory: null 
        };

        // 아이템 기본 정보 데이터베이스 (ITEM_DB)는 data/items.js로 분리되었습니다.

        let myInventoryItems = [
            { id: "item_1", baseId: "sword_basic", gridX: 0, gridY: 0, rot: 0 },
            { id: "item_2", baseId: "armor_iron",  gridX: 2, gridY: 0, rot: 0 },
            { id: "item_3", baseId: "potion_hp",   gridX: 4, gridY: 0, rot: 0 },
            { id: "item_4", baseId: "sword_basic", gridX: 0, gridY: 4, rot: 1 }, 
            { id: "item_5", baseId: "axe_battle",  gridX: 5, gridY: 5, rot: 0 }  
        ];

        // 창고 지급 로직
        if (typeof personalStorage !== "undefined") {
            if (personalStorage.length === 0) {
                personalStorage.push({ id: "scroll_1", baseId: "scroll_smite", gridX: 6, gridY: 8, rot: 0 });
            }
            // ★ 순간이동 스킬북 창고에 자동 지급 (배우지 않았다면)
            let hasTeleportBook = personalStorage.some(i => i.baseId === "book_teleport");
            if (!hasTeleportBook && (!player.unlockedSkills || !player.unlockedSkills.includes("teleport"))) {
                personalStorage.push({ id: "book_teleport_1", baseId: "book_teleport", gridX: 4, gridY: 8, rot: 0 });
            }
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
              enchantHtml = enchants.map(id => {
                  const data = ITEM_DB[id];
                  return data?.enchantEffect
                      ? `<div style="color:#ff8888">- ${data.enchantEffect.name}</div>`
                      : "";
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

      function renderBoardGrid(boardId, itemList, mapArray, sourceName) {
          const board = document.getElementById(boardId);
          if (!board) return;

          board.innerHTML = "";

          for (let r = 0; r < INV_ROWS; r++) {
              for (let c = 0; c < INV_COLS; c++) {
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

                          if (gy >= 0 && gy < INV_ROWS && gx >= 0 && gx < INV_COLS) {
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
                  attemptRotate(item, wrapper, sourceName);
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

          if (player.unlockedSkills.includes(skillId)) {
              addFloatingText(
                  player.x,
                  player.y - 30,
                  "이미 습득한 스킬입니다.",
                  "gray"
              );
              return;
          }

          player.unlockedSkills.push(skillId);
          player.newlyAcquiredSkills.push(skillId);

          if (dragItemState.active && dragItemState.ghostEl) {
              dragItemState.ghostEl.remove();
              dragItemState.active = false;
              hideDragStatsPanel();
          }

          const targetArray =
              sourceName === "storage" ? personalStorage : myInventoryItems;

          const idx = targetArray.findIndex(
              i => (i.id || i.uid) === (itemObj.id || itemObj.uid)
          );

          if (idx > -1) {
              targetArray.splice(idx, 1);
          }

          const skillName = MOCK_SKILLS[skillId]?.name || skillId;
          addFloatingText(
              player.x,
              player.y - 30,
              `[${skillName}] 습득!`,
              "gold"
          );

          closeItemDetail();

          if (typeof renderGridInventory === "function") {
              renderGridInventory();
          }

          if (currentRightView === "enchant" &&
              typeof renderSkillUI === "function") {
              renderSkillUI();
          }
      }

      function renderGridInventory() {
          renderEquipSlotsUI();

          renderBoardGrid(
              "inventoryBoard",
              myInventoryItems,
              gridMap,
              "inventory"
          );

          if (gameState === "storage") {
              renderBoardGrid(
                  "storageBoard",
                  personalStorage,
                  storageMap,
                  "storage"
              );
          }
      }
      // [MOD-020-4-END]


        // [MOD-020-5: 장비창 UI 렌더링 함수] - 기존 코드 유지 (덮어씌우지 않아도 됨)

        // [MOD-020-6: 비정형 블록 제자리 회전 검사 (멀티 보드 대응)]
        function attemptRotate(itemObj, htmlEl, sourceName) {
            const baseItem = ITEM_DB[itemObj.baseId];
            let nextRot = (itemObj.rot + 1) % 4; 
            const newShape = getRotatedShape(baseItem.shape, nextRot);
            const newH = newShape.length, newW = newShape[0].length;
            let canRotate = true;
            let targetMap = sourceName === "storage" ? storageMap : gridMap;

            for(let r = 0; r < newH; r++) {
                for(let c = 0; c < newW; c++) {
                    if(newShape[r][c] === 1) {
                        let gy = itemObj.gridY + r, gx = itemObj.gridX + c;
                        if(gy < 0 || gy >= INV_ROWS || gx < 0 || gx >= INV_COLS) { canRotate = false; break; }
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

        // [MOD-020-7: 기존 드래그 상세창 완전 제거 - 클릭 상세창으로 단일화]
        function showDragStatsPanel(itemObj, source) {}
        function hideDragStatsPanel() {}

        // --- 드래그 로직 ---
        function startDrag(e, itemObj, htmlEl, sourceName) {
            if (e.type === "mousedown" && e.button !== 0) return; 

            dragItemState.active = true;
            dragItemState.itemRef = itemObj;
            dragItemState.origX = itemObj.gridX;
            dragItemState.origY = itemObj.gridY;
            dragItemState.source = sourceName;
            dragItemState.hoveredEquipSlot = null; 

            let clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
            let clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

            const boardId = sourceName === "storage" ? "storageBoard" : "inventoryBoard";
            const board = document.getElementById(boardId);
            const boardRect = board.getBoundingClientRect();
            const currentScale = boardRect.width / (INV_COLS * GRID_CELL_SIZE);

            const elRect = htmlEl.getBoundingClientRect();
            dragItemState.offsetX = (clientX - elRect.left) / currentScale;
            dragItemState.offsetY = (clientY - elRect.top) / currentScale;
            dragItemState.lastClientX = clientX;
            dragItemState.lastClientY = clientY;

            const baseItem = ITEM_DB[itemObj.baseId];
            const shape = getRotatedShape(baseItem.shape, itemObj.rot);
            const h = shape.length, w = shape[0].length;
            let targetMap = sourceName === "storage" ? storageMap : gridMap;
            
            for(let r = 0; r < h; r++) {
                for(let c = 0; c < w; c++) {
                    if(shape[r][c] === 1) {
                        let gy = itemObj.gridY + r, gx = itemObj.gridX + c;
                        if(gy >= 0 && gy < INV_ROWS && gx >= 0 && gx < INV_COLS) targetMap[gy][gx] = null;
                    }
                }
            }

            let ghost = document.createElement("div");
            ghost.className = "grid-item-wrapper dragging"; 
            ghost.style.width = htmlEl.style.width;
            ghost.style.height = htmlEl.style.height;
            ghost.innerHTML = htmlEl.innerHTML; 
            
            board.appendChild(ghost);
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

            let clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
            let clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

            player.equipment[slotName] = null;
            if (currentEnchantTargetSlot === slotName) clearEnchantRegistration();
            updatePlayerTotalStats();
            renderEquipSlotsUI();

            const board = document.getElementById("inventoryBoard");
            const boardRect = board.getBoundingClientRect();
            const currentScale = boardRect.width > 0 ? boardRect.width / (INV_COLS * GRID_CELL_SIZE) : 1;

            dragItemState.offsetX = GRID_CELL_SIZE / 2; 
            dragItemState.offsetY = GRID_CELL_SIZE / 2;
            dragItemState.lastClientX = clientX;
            dragItemState.lastClientY = clientY;

            let ghost = createGhostDOMForItem(itemObj);
            ghost.className = "grid-item-wrapper dragging"; 
            
            board.appendChild(ghost);
            dragItemState.ghostEl = ghost;

            document.addEventListener("mousemove", onDragMove);
            document.addEventListener("mouseup", onDragEnd);
            document.addEventListener("touchmove", onDragMove, { passive: false });
            document.addEventListener("touchend", onDragEnd);
            
            updateDragGhost();
        }

        function createGhostDOMForItem(itemObj) {
            const baseItem = ITEM_DB[itemObj.baseId];
            const shape = getRotatedShape(baseItem.shape, itemObj.rot);
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
            
            // ★ 수정: 드래그가 실제로 시작(이동)되었을 때 원본을 숨김
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
            const invBoard = document.getElementById("inventoryBoard");
            const stoBoard = document.getElementById("storageBoard");
            
            const invRect = invBoard.getBoundingClientRect();
            const stoRect = stoBoard && gameState === "storage" ? stoBoard.getBoundingClientRect() : {left:-999, right:-999, top:-999, bottom:-999, width:0};
            
            let referenceWidth = invRect.width > 0 ? invRect.width : (stoRect.width > 0 ? stoRect.width : 320);
            const currentScale = referenceWidth / (INV_COLS * GRID_CELL_SIZE); 

            let targetBoardName = null;
            let targetRect = null;
            let targetMap = null;

            if (gameState === "storage" && dragItemState.lastClientX >= stoRect.left && dragItemState.lastClientX <= stoRect.right && dragItemState.lastClientY >= stoRect.top && dragItemState.lastClientY <= stoRect.bottom) {
                targetBoardName = "storage"; targetRect = stoRect; targetMap = storageMap;
            } else if (invRect.width > 0 && dragItemState.lastClientX >= invRect.left && dragItemState.lastClientX <= invRect.right && dragItemState.lastClientY >= invRect.top && dragItemState.lastClientY <= invRect.bottom) {
                targetBoardName = "inventory"; targetRect = invRect; targetMap = gridMap;
            }

            dragItemState.targetBoard = targetBoardName;
            let isInsideBoard = false;
            let rawGridX = 0, rawGridY = 0;

            if (targetBoardName) {
                let localX = (dragItemState.lastClientX - targetRect.left) / currentScale - dragItemState.offsetX;
                let localY = (dragItemState.lastClientY - targetRect.top) / currentScale - dragItemState.offsetY;

                rawGridX = Math.round(localX / GRID_CELL_SIZE);
                rawGridY = Math.round(localY / GRID_CELL_SIZE);

                dragItemState.currentGridX = rawGridX;
                dragItemState.currentGridY = rawGridY;
                dragItemState.isValid = true;
                isInsideBoard = true;

                const baseItem = ITEM_DB[dragItemState.itemRef.baseId];
                const shape = getRotatedShape(baseItem.shape, dragItemState.itemRef.rot);
                const h = shape.length, w = shape[0].length;

                for(let r = 0; r < h; r++) {
                    for(let c = 0; c < w; c++) {
                        if(shape[r][c] === 1) {
                            let gy = rawGridY + r, gx = rawGridX + c;
                            if (gy < 0 || gy >= INV_ROWS || gx < 0 || gx >= INV_COLS) { dragItemState.isValid = false; isInsideBoard = false; break; }
                            if (targetMap[gy][gx] !== null) { dragItemState.isValid = false; }
                        }
                    }
                }

                let activeBoardDOM = targetBoardName === "storage" ? stoBoard : invBoard;
                if (dragItemState.ghostEl.parentElement !== activeBoardDOM) {
                    activeBoardDOM.appendChild(dragItemState.ghostEl);
                }
                
                if (isInsideBoard) {
                    dragItemState.ghostEl.style.left = (rawGridX * GRID_CELL_SIZE) + "px";
                    dragItemState.ghostEl.style.top = (rawGridY * GRID_CELL_SIZE) + "px";
                } else {
                    dragItemState.ghostEl.style.left = localX + "px";
                    dragItemState.ghostEl.style.top = localY + "px";
                }
            } else {
                dragItemState.isValid = false;
                let activeBoardDOM = dragItemState.ghostEl.parentElement;
                let activeRect = activeBoardDOM.getBoundingClientRect();
                let localX = (dragItemState.lastClientX - activeRect.left) / currentScale - dragItemState.offsetX;
                let localY = (dragItemState.lastClientY - activeRect.top) / currentScale - dragItemState.offsetY;
                dragItemState.ghostEl.style.left = localX + "px";
                dragItemState.ghostEl.style.top = localY + "px";
            }

            dragItemState.hoveredEquipSlot = null; 
            const ghostRect = dragItemState.ghostEl.getBoundingClientRect();
            const baseItem = ITEM_DB[dragItemState.itemRef.baseId];
            
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

            const isAcceptable = dragItemState.isValid || (dragItemState.hoveredEquipSlot !== null);
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

            hideDragStatsPanel(); // ★ 드래그가 끝나면 스탯 패널 즉시 숨김

            let isEquipped = false;
            let sourceArray = dragItemState.source === "storage" ? personalStorage : myInventoryItems;

            if (dragItemState.hoveredEquipSlot) {
                let targetSlotName = dragItemState.hoveredEquipSlot.getAttribute('data-slot');
                let baseItem = ITEM_DB[dragItemState.itemRef.baseId];
                
                if (baseItem.type === "equip" && baseItem.equipSlot === targetSlotName) {
                    let oldItem = player.equipment[targetSlotName];
                    let canSwap = true;

                    if (oldItem) {
                        let targetMap = dragItemState.source === "storage" ? storageMap : gridMap;
                        let targetArr = dragItemState.source === "storage" ? personalStorage : myInventoryItems;
                        
                        if (dragItemState.source === "equipment") {
                            canSwap = false; 
                        } else if (canPlaceItem(oldItem, dragItemState.origX, dragItemState.origY, targetMap)) {
                            oldItem.gridX = dragItemState.origX;
                            oldItem.gridY = dragItemState.origY;
                            targetArr.push(oldItem);
                        } else {
                            let freePos = findFreeSpace(oldItem, targetMap);
                            if (freePos) {
                                oldItem.gridX = freePos.x;
                                oldItem.gridY = freePos.y;
                                targetArr.push(oldItem);
                            } else {
                                alert("인벤토리에 기존 장비를 해제할 빈 공간이 부족하여 교체할 수 없습니다!");
                                canSwap = false;
                            }
                        }
                    }

                    if (canSwap) {
                        isEquipped = true;
                        if (dragItemState.source !== "equipment") {
                            let idx = sourceArray.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                            if(idx > -1) sourceArray.splice(idx, 1);
                        }
                        if(!dragItemState.itemRef.sockets) dragItemState.itemRef.sockets = Array(baseItem.maxSockets).fill(null);
                        
                        player.equipment[targetSlotName] = dragItemState.itemRef;
                        
                        if (typeof updatePlayerTotalStats === "function") updatePlayerTotalStats();
                        if (typeof renderEquipSlotsUI === "function") renderEquipSlotsUI();
                    }
                }
            }

            document.querySelectorAll('.equip-slot').forEach(s => {
                s.style.boxShadow = ""; s.style.borderColor = ""; s.style.transform = "scale(1.0)";
            });

            if (!isEquipped) {
                if (dragItemState.isValid && dragItemState.targetBoard) {
                    let targetArray = dragItemState.targetBoard === "storage" ? personalStorage : myInventoryItems;
                    
                    if (dragItemState.source === "equipment") {
                        targetArray.push(dragItemState.itemRef);
                    } else if (dragItemState.source !== dragItemState.targetBoard) {
                        let idx = sourceArray.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                        if(idx > -1) sourceArray.splice(idx, 1);
                        targetArray.push(dragItemState.itemRef);
                    }
                    dragItemState.itemRef.gridX = dragItemState.currentGridX;
                    dragItemState.itemRef.gridY = dragItemState.currentGridY;
                } else {
                    const invContainer = document.getElementById("invMainContainer");
                    const invRect = invContainer ? invContainer.getBoundingClientRect() : null;
                    const isOutsideUI = invRect && (
                        dragItemState.lastClientX < invRect.left ||
                        dragItemState.lastClientX > invRect.right ||
                        dragItemState.lastClientY < invRect.top ||
                        dragItemState.lastClientY > invRect.bottom
                    );

                    if (isOutsideUI) {
                        const dropDist = 35;
                        const dropAngle = Math.random() * Math.PI * 2;
                        let dropX = Math.max(50, Math.min(WORLD_WIDTH - 50, player.x + Math.cos(dropAngle) * dropDist));
                        let dropY = Math.max(50, Math.min(WORLD_HEIGHT - 50, player.y + Math.sin(dropAngle) * dropDist));

                        fieldItems.push({
                            id: dragItemState.itemRef.id || ("field_" + Date.now()),
                            baseId: dragItemState.itemRef.baseId,
                            rot: dragItemState.itemRef.rot || 0,
                            sockets: dragItemState.itemRef.sockets ? [...dragItemState.itemRef.sockets] : null,
                            x: dropX,
                            y: dropY,
                            pickupDelay: 60, 
                            errorFlashTimer: 0
                        });

                        if (dragItemState.source === "inventory") {
                            let idx = myInventoryItems.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                            if (idx > -1) myInventoryItems.splice(idx, 1);
                        } else if (dragItemState.source === "storage") {
                            let idx = personalStorage.findIndex(i => (i.id || i.uid) === (dragItemState.itemRef.id || dragItemState.itemRef.uid));
                            if (idx > -1) personalStorage.splice(idx, 1);
                        } else if (dragItemState.source === "equipment") {
                            updatePlayerTotalStats();
                            renderEquipSlotsUI();
                        }
                    } else {
                        if (dragItemState.source === "equipment") {
                            player.equipment[dragItemState.sourceSlot] = dragItemState.itemRef;
                            updatePlayerTotalStats();
                            renderEquipSlotsUI();
                        } else {
                            dragItemState.itemRef.gridX = dragItemState.origX;
                            dragItemState.itemRef.gridY = dragItemState.origY;
                        }
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
            const baseItem = ITEM_DB[itemObj.baseId];
            const shape = getRotatedShape(baseItem.shape, itemObj.rot);
            const h = shape.length, w = shape[0].length;
            for(let r=0; r<h; r++){
                for(let c=0; c<w; c++){
                    if(shape[r][c] === 1){
                        let gy = gridY + r, gx = gridX + c;
                        if(gy < 0 || gy >= INV_ROWS || gx < 0 || gx >= INV_COLS) return false;
                        if(map[gy][gx] !== null) return false;
                    }
                }
            }
            return true;
        }

        function findFreeSpace(itemObj, map) {
            for(let y=0; y<INV_ROWS; y++){
                for(let x=0; x<INV_COLS; x++){
                    if(canPlaceItem(itemObj, x, y, map)) return {x, y};
                }
            }
            return null;
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
        }
