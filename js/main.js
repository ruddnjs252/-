// [MAIN: 메인 게임 루프 및 초기 킥오프]

// [MOD-018: 메인 게임 루프 (60프레임 반복 렌더링)]
        function gameLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 타이틀, 로그인, 로비 화면일 때는 무거운 월드 렌더링을 건너뜀
            if (gameState === "title" || gameState === "login" || gameState === "intro" || gameState === "lobby" || gameState === "charCreation" || gameState === "npcMenu") { 
                requestAnimationFrame(gameLoop); return; 
            }

            const pCenterX = player.x;
            const pCenterY = player.y;
            const playerRadius = player.width / 2;
            
            const activeSkill = typeof getActiveQuickSlotSkill === "function" ? getActiveQuickSlotSkill() : null;

            for (let sId in player.skillCooldowns) {
                if (player.skillCooldowns[sId] > 0) player.skillCooldowns[sId]--;
            }

            if (gameState === "playing") {
                let wMouseX = mouseX + camera.x;
                let wMouseY = mouseY + camera.y;
                let minScore = Infinity;
                let bestTarget = null;
                const PICKUP_RADIUS = 105; 

                for (let i = 0; i < fieldItems.length; i++) {
                    let fItem = fieldItems[i];
                    if (fItem.pickupDelay > 0) fItem.pickupDelay--;
                    if (fItem.errorFlashTimer > 0) fItem.errorFlashTimer--;

                    let distToPlayer = Math.hypot(fItem.x - pCenterX, fItem.y - pCenterY);
                    
                    if (distToPlayer <= PICKUP_RADIUS) {
                        let distToMouse = Math.hypot(fItem.x - wMouseX, fItem.y - wMouseY);
                        let score = distToMouse < 45 ? distToMouse : distToPlayer + 100;
                        if (score < minScore) {
                            minScore = score;
                            bestTarget = fItem;
                        }
                    }
                }
                targetedFieldItem = bestTarget;

                // [모바일 상자 접근 감지 및 vpad-e 버튼 동적 전환]
                let isNearChest = false;
                if (currentMap === "guild" && typeof MAP_DATA !== "undefined" && MAP_DATA.guild && MAP_DATA.guild.personalChest) {
                    const chs = MAP_DATA.guild.personalChest;
                    const distToChest = Math.hypot((chs.x + chs.w / 2) - pCenterX, (chs.y + chs.h / 2) - pCenterY);
                    if (distToChest < 130) {
                        isNearChest = true;
                    }
                }
                window.isNearPersonalChest = isNearChest;
                const vpadE = document.getElementById("vpad-e");
                if (vpadE) {
                    if (isNearChest) {
                        if (vpadE.innerText !== "상자") {
                            vpadE.innerText = "상자";
                            vpadE.classList.add("vpad-chest");
                        }
                    } else {
                        if (vpadE.innerText !== "가방") {
                            vpadE.innerText = "가방";
                            vpadE.classList.remove("vpad-chest");
                        }
                    }
                }
            }

            if (gameState === "playing") {
                let nextX = player.x;
                let nextY = player.y;

                if (player.dashTimer > 0) {
                    player.dashTimer--;
                    nextX += player.dashDirX * player.dashSpeed;
                    nextY += player.dashDirY * player.dashSpeed;

                    if (player.activeSkillType === "charge") {
                        const distToTarget = Math.hypot((player.targetX) - nextX, (player.targetY) - nextY);
                        if (distToTarget <= player.dashSpeed) {
                            nextX = player.targetX; nextY = player.targetY; player.dashTimer = 0;
                        }
                    }

                    if (nextX - playerRadius <= 0 || nextX + playerRadius >= WORLD_WIDTH || nextY - playerRadius <= 0 || nextY + playerRadius >= WORLD_HEIGHT || checkObstacleCollision(nextX - playerRadius, nextY - playerRadius)) {
                        player.dashTimer = 0; nextX = player.x; nextY = player.y; 
                    }

                    if ((player.activeSkillType === "charge" || player.activeSkillType === "leap_attack") && currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon.goblin.active) {
                        let gob = MAP_DATA.dungeon.goblin;
                        if (Math.hypot(nextX - gob.x, nextY - gob.y) < playerRadius + gob.size/2) {
                            const dmg = (player.stats.str * 3) + (activeSkill ? activeSkill.bonusDmg : 0);
                            applyDamageToGoblin(dmg);
                        }
                    }
                } else {
                    let isMoving = keys["ArrowUp"] || keys["w"] || keys["s"] || keys["ArrowDown"] || keys["a"] || keys["ArrowLeft"] || keys["d"] || keys["ArrowRight"];
                    let currentSpeed = player.speed;
                    let isSprinting = false;

                    if (keys["Shift"] && isMoving && player.currentStamina >= 1) {
                        isSprinting = true;
                        currentSpeed = player.speed * 1.6;
                        player.sprintTimer = (player.sprintTimer || 0) + 1;
                        if (player.sprintTimer >= 60) {
                            player.currentStamina -= 1;
                            player.sprintTimer = 0;
                        }
                    } else {
                        player.sprintTimer = 0;
                    }

                    if (keys["ArrowUp"] || keys["w"]) nextY -= currentSpeed;
                    if (keys["ArrowDown"] || keys["s"]) nextY += currentSpeed;
                    if (keys["ArrowLeft"] || keys["a"]) nextX -= currentSpeed;
                    if (keys["ArrowRight"] || keys["d"]) nextX += currentSpeed;

                    nextX = Math.max(playerRadius, Math.min(nextX, WORLD_WIDTH - playerRadius));
                    nextY = Math.max(playerRadius, Math.min(nextY, WORLD_HEIGHT - playerRadius));

                    if (checkObstacleCollision(nextX - playerRadius, nextY - playerRadius)) {
                        nextX = player.x; nextY = player.y;
                    }

                    if (!isSprinting && player.currentStamina < player.maxStamina) {
                        player.staminaRegenTimer++;
                        if (player.staminaRegenTimer >= 60) {
                            player.currentStamina = Math.min(player.maxStamina, player.currentStamina + 1);
                            player.staminaRegenTimer = 0;
                        }
                    } else {
                        player.staminaRegenTimer = 0;
                    }
                }

                player.x = nextX;
                player.y = nextY;

                if (attackTimer > 0) attackTimer--;

// [자동 공격 시스템 삭제: 좌클릭 수동 공격으로 대체]

                // [원거리 투사체(화살) 이동 및 피격 처리]
                if (typeof projectiles !== "undefined" && projectiles.length > 0) {
                    for (let i = projectiles.length - 1; i >= 0; i--) {
                        let p = projectiles[i];
                        p.x += p.vx;
                        p.y += p.vy;
                        p.traveled += Math.hypot(p.vx, p.vy);

                        // 벽/장애물 충돌 검사
                        if (typeof checkObstacleCollision === "function" && checkObstacleCollision(p.x - 5, p.y - 5)) {
                            if (typeof addVisualEffect === "function") addVisualEffect(p.x, p.y, 10, "gray");
                            projectiles.splice(i, 1);
                            continue;
                        }

                        // 던전 고블린 피격 검사
                        if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon.goblin.active) {
                            const gob = MAP_DATA.dungeon.goblin;
                            if (Math.hypot(gob.x - p.x, gob.y - p.y) < gob.size / 2 + 12) {
                                if (typeof applyDamageToGoblin === "function") applyDamageToGoblin(p.damage);
                                if (typeof addVisualEffect === "function") addVisualEffect(p.x, p.y, 25, "red");
                                projectiles.splice(i, 1);
                                continue;
                            }
                        }

                        // 최대 사거리 도달 또는 맵 경계 이탈 시 소멸
                        if (p.traveled >= p.maxDist || p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) {
                            projectiles.splice(i, 1);
                        }
                    }
                }

            } else if (gameState === "knockback") {
                player.x += player.knockbackDirX * 25;
                player.y += player.knockbackDirY * 5;
                
                if (player.x <= playerRadius || player.x >= WORLD_WIDTH - playerRadius || player.y <= playerRadius) {
                    player.x = Math.max(playerRadius, Math.min(player.x, WORLD_WIDTH - playerRadius));
                    gameState = "dead";
                    document.getElementById("deathUI").style.display = "flex";
                }
            }

            camera.x = player.x - canvas.width / 2;
            camera.y = player.y - canvas.height / 2;
            camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
            camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));

            // === [월드 렌더링 시작] ===
            ctx.save();
            ctx.translate(-camera.x, -camera.y);

            // 타일 격자
            ctx.strokeStyle = "#3a3a3a";
            ctx.lineWidth = 1;
            for(let i = 0; i <= WORLD_WIDTH; i += 100) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD_HEIGHT); ctx.stroke();
            }
            for(let i = 0; i <= WORLD_HEIGHT; i += 100) {
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(WORLD_WIDTH, i); ctx.stroke();
            }

            // 길드 오브젝트
            if (currentMap === "guild" && typeof MAP_DATA !== "undefined") {
                const por = MAP_DATA.guild.portal;
                const chs = MAP_DATA.guild.personalChest;

                ctx.fillStyle = por.color; ctx.fillRect(por.x, por.y, por.w, por.h);
                ctx.fillStyle = "white"; ctx.font = "bold 14px sans-serif"; 
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("포탈", por.x + por.w/2, por.y - 15);

                ctx.fillStyle = chs.color; ctx.fillRect(chs.x, chs.y, chs.w, chs.h);
                ctx.strokeStyle = "#8B6508"; ctx.lineWidth = 3; ctx.strokeRect(chs.x, chs.y, chs.w, chs.h);
                ctx.fillStyle = "white"; ctx.font = "bold 12px sans-serif";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("개인 창고", chs.x + chs.w/2, chs.y - 10);
            } 
            // 던전 고블린
            else if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined") {
                // 던전 귀환 포탈 렌더링
                if (MAP_DATA.dungeon.portal) {
                    const dPor = MAP_DATA.dungeon.portal;
                    ctx.fillStyle = dPor.color; ctx.fillRect(dPor.x, dPor.y, dPor.w, dPor.h);
                    ctx.strokeStyle = "#4B0082"; ctx.lineWidth = 2; ctx.strokeRect(dPor.x, dPor.y, dPor.w, dPor.h);
                    ctx.fillStyle = "white"; ctx.font = "bold 13px sans-serif";
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillText("길드 귀환", dPor.x + dPor.w/2, dPor.y - 12);
                }

                let gob = MAP_DATA.dungeon.goblin;
                if (gob.active) {
                    const dx = pCenterX - gob.x, dy = pCenterY - gob.y;
                    const dist = Math.hypot(dx, dy);
                    if (gameState === "playing") {
                        if (dist > 20) {
                            gob.x += (dx / dist) * gob.speed; gob.y += (dy / dist) * gob.speed;
                        } else {
                            if (Math.random() < 0.05) { 
                                player.currentHp -= gob.damage;
                                addFloatingText(pCenterX, player.y - 10, gob.damage, "red");
                                if (player.currentHp < 0) player.currentHp = 0; 
                            }
                        }
                    }

                    if (player.lockedTarget === gob) {
                        ctx.beginPath();
                        ctx.arc(gob.x, gob.y, gob.size + 10, 0, Math.PI * 2);
                        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
                        ctx.lineWidth = 3;
                        ctx.setLineDash([6, 6]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    ctx.fillStyle = "limegreen";
                    ctx.beginPath(); ctx.moveTo(gob.x, gob.y - gob.size / 2);
                    ctx.lineTo(gob.x - gob.size / 2, gob.y + gob.size / 2);
                    ctx.lineTo(gob.x + gob.size / 2, gob.y + gob.size / 2); ctx.fill();

                    const tagY = gob.y - gob.size - 25;
                    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(gob.x - 40, tagY, 80, 16);
                    ctx.fillStyle = "white"; ctx.font = "bold 12px sans-serif"; 
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillText(gob.name, gob.x, tagY + 8);
                    ctx.fillStyle = "red"; ctx.fillRect(gob.x - 40, tagY + 18, 80 * Math.max(0, gob.hp / gob.maxHp), 3);
                }
            }

            // 필드 아이템 렌더링
            const FIELD_CELL_SIZE = 18; 
            const SHADOW_OFFSET_X = -5; 
            const SHADOW_OFFSET_Y = 3;  

            fieldItems.forEach(fItem => {
                const baseItem = ITEM_DB[fItem.baseId];
                if (!baseItem) return;
                const shape = getRotatedShape(baseItem.shape, fItem.rot);
                const h = shape.length, w = shape[0].length;
                const itemPixelW = w * FIELD_CELL_SIZE;
                const itemPixelH = h * FIELD_CELL_SIZE;
                const startX = fItem.x - itemPixelW / 2;
                const startY = fItem.y - itemPixelH / 2;

                const isTarget = (fItem === targetedFieldItem);
                const isError = (fItem.errorFlashTimer > 0);

                ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
                for(let r = 0; r < h; r++) {
                    for(let c = 0; c < w; c++) {
                        if (shape[r][c] === 1) {
                            let shadowX = startX + c * FIELD_CELL_SIZE + SHADOW_OFFSET_X;
                            let shadowY = startY + r * FIELD_CELL_SIZE + SHADOW_OFFSET_Y;
                            ctx.fillRect(shadowX, shadowY, FIELD_CELL_SIZE, FIELD_CELL_SIZE);
                        }
                    }
                }

                for(let r = 0; r < h; r++) {
                    for(let c = 0; c < w; c++) {
                        if (shape[r][c] === 1) {
                            let bx = startX + c * FIELD_CELL_SIZE;
                            let by = startY + r * FIELD_CELL_SIZE;

                            ctx.fillStyle = baseItem.color;
                            ctx.fillRect(bx, by, FIELD_CELL_SIZE, FIELD_CELL_SIZE);

                            if (isError) {
                                ctx.strokeStyle = "#ff2222"; ctx.lineWidth = 2.5;
                            } else if (isTarget) {
                                ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 2.5;
                            } else {
                                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 1;
                            }
                            ctx.strokeRect(bx, by, FIELD_CELL_SIZE, FIELD_CELL_SIZE);
                        }
                    }
                }

                ctx.save();
                ctx.font = isTarget ? "bold 12px sans-serif" : "11px sans-serif";
                ctx.textAlign = "center"; ctx.textBaseline = "bottom";
                ctx.fillStyle = isError ? "#ff4444" : (isTarget ? "#ffe066" : "rgba(255, 255, 255, 0.85)");
                ctx.shadowColor = "black"; ctx.shadowBlur = 3;
                ctx.fillText(baseItem.name, fItem.x, startY - 3);
                ctx.restore();
            });

            for (let i = visualEffects.length - 1; i >= 0; i--) {
                let eff = visualEffects[i];
                ctx.save(); ctx.beginPath(); ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
                ctx.fillStyle = eff.color; ctx.globalAlpha = eff.alpha; ctx.fill(); ctx.restore();
                eff.alpha -= 0.04; eff.timer--;
                if (eff.timer <= 0) visualEffects.splice(i, 1);
            }

            // 플레이어 본체
            ctx.beginPath();
            ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
            ctx.fillStyle = "#00a2ff"; 
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#004488"; 
            ctx.stroke();

            // 무기 및 조준선 렌더링
            if (gameState === "playing") {
                let wMouseX = mouseX + camera.x;
                let wMouseY = mouseY + camera.y;
                const aimAngle = Math.atan2(wMouseY - pCenterY, wMouseX - pCenterX);

                if (player.aimingSkill === "leap_only") {
                    const fixedLeapDist = player.width * 3;
                    const leapW = player.width + 10;
                    ctx.save(); ctx.translate(pCenterX, pCenterY); ctx.rotate(aimAngle);
                    ctx.fillStyle = "rgba(255, 215, 0, 0.3)"; ctx.fillRect(0, -leapW / 2, fixedLeapDist, leapW);
                    ctx.strokeStyle = "gold"; ctx.lineWidth = 2; ctx.strokeRect(0, -leapW / 2, fixedLeapDist, leapW); ctx.restore();
                } else if (player.aimingSkill === "jump_slam") {
                    ctx.save(); ctx.beginPath(); ctx.arc(wMouseX, wMouseY, 80, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(255, 69, 0, 0.25)"; ctx.fill();
                    ctx.strokeStyle = "orangered"; ctx.lineWidth = 2; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(pCenterX, pCenterY); ctx.lineTo(wMouseX, wMouseY);
                    ctx.strokeStyle = "rgba(255, 69, 0, 0.4)"; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.restore();
                } else if (player.aimingSkill === "charge") {
                    const chargeDist = Math.hypot(wMouseX - pCenterX, wMouseY - pCenterY);
                    const chargeW = player.width + 10;
                    ctx.save(); ctx.translate(pCenterX, pCenterY); ctx.rotate(aimAngle);
                    ctx.fillStyle = "rgba(255, 215, 0, 0.25)"; ctx.fillRect(0, -chargeW / 2, chargeDist, chargeW);
                    ctx.strokeStyle = "gold"; ctx.lineWidth = 2; ctx.strokeRect(0, -chargeW / 2, chargeDist, chargeW); ctx.restore();
                } 
                // ★ 순간이동 궤적/도착지점 렌더링
                else if (player.aimingSkill === "teleport") {
                    const maxDist = 250;
                    const dist = Math.min(maxDist, Math.hypot(wMouseX - pCenterX, wMouseY - pCenterY));
                    const targetX = pCenterX + Math.cos(aimAngle) * dist;
                    const targetY = pCenterY + Math.sin(aimAngle) * dist;
                    
                    ctx.save();
                    // 도착 예정 지점 원
                    ctx.beginPath(); ctx.arc(targetX, targetY, playerRadius, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(100, 50, 255, 0.3)"; ctx.fill();
                    ctx.strokeStyle = "purple"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke();
                    
                    // 예상 궤적 연결선
                    ctx.beginPath(); ctx.moveTo(pCenterX, pCenterY); ctx.lineTo(targetX, targetY);
                    ctx.strokeStyle = "rgba(100, 50, 255, 0.5)"; ctx.stroke();
                    ctx.restore();
                }
                
                // [원거리 화살 투사체 렌더링]
                if (typeof projectiles !== "undefined") {
                    projectiles.forEach(p => {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.angle);
                        
                        // 화살대 (갈색)
                        ctx.strokeStyle = "#8B5A2B";
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(-15, 0);
                        ctx.lineTo(15, 0);
                        ctx.stroke();

                        // 화살촉 (은색 메탈)
                        ctx.fillStyle = "#E0E0E0";
                        ctx.beginPath();
                        ctx.moveTo(17, 0);
                        ctx.lineTo(9, -5);
                        ctx.lineTo(9, 5);
                        ctx.closePath();
                        ctx.fill();

                        // 화살 깃털 (흰색)
                        ctx.fillStyle = "white";
                        ctx.beginPath();
                        ctx.moveTo(-15, 0);
                        ctx.lineTo(-21, -4);
                        ctx.lineTo(-13, 0);
                        ctx.lineTo(-21, 4);
                        ctx.closePath();
                        ctx.fill();

                        ctx.restore();
                    });
                }

                const wpn = player.equipment?.mainWeapon;
                const isBowEquipped = wpn && (wpn.baseId === "bow_basic" || (typeof ITEM_DB !== "undefined" && ITEM_DB[wpn.baseId]?.weaponType === "bow"));

                if (isBowEquipped) {
                    // ★ 활(Bow) 무기 외형 렌더링
                    ctx.save();
                    ctx.translate(pCenterX, pCenterY);
                    ctx.rotate(aimAngle);
                    ctx.translate(playerRadius + 8, 0);

                    // 활대 (갈색 우드 곡선)
                    ctx.beginPath();
                    ctx.arc(0, 0, 26, -Math.PI / 2.3, Math.PI / 2.3);
                    ctx.strokeStyle = "#8B5A2B";
                    ctx.lineWidth = 4;
                    ctx.stroke();

                    // 활시위 (연한 흰색)
                    const stringTopY = -Math.sin(Math.PI / 2.3) * 26;
                    const stringBotY = Math.sin(Math.PI / 2.3) * 26;
                    const stringX = Math.cos(Math.PI / 2.3) * 26;
                    
                    let pullX = stringX - 10;
                    if (attackTimer > 0) {
                        pullX = stringX - (attackTimer / 22) * 14;
                    }
                    ctx.beginPath();
                    ctx.moveTo(stringX, stringTopY);
                    ctx.lineTo(pullX, 0);
                    ctx.lineTo(stringX, stringBotY);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    ctx.restore();
                } else {
                    const weaponLength = 50, weaponWidth = 12, pivotX = 0, pivotY = playerRadius + 25;
                let currentAngle = aimAngle;
                let isSwinging = (attackTimer > 0 && player.lastAttackAngle !== undefined);
                let wristAngle = -Math.PI / 6; 

                if (isSwinging) {
                    let progress = 1.0 - (attackTimer / 30);
                    let startAngle = player.lastAttackAngle - Math.PI / 3;
                    let endAngle = player.lastAttackAngle + Math.PI / 3;
                    currentAngle = startAngle + (endAngle - startAngle) * progress;
                    wristAngle = (-Math.PI / 6) * (1 - Math.sin(progress * Math.PI));

                    ctx.beginPath();
                    const swingRadius = Math.hypot(weaponLength, pivotY);
                    const tipOffsetAngle = Math.atan2(pivotY, weaponLength);
                    ctx.arc(pCenterX, pCenterY, swingRadius, startAngle + tipOffsetAngle, currentAngle + tipOffsetAngle);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                    ctx.lineWidth = 15;
                    ctx.stroke();
                }

                ctx.save();
                ctx.translate(pCenterX, pCenterY);
                ctx.rotate(currentAngle);
                ctx.translate(pivotX, pivotY);
                ctx.rotate(wristAngle);
                
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                ctx.fillRect(0, -weaponWidth / 2, weaponLength, weaponWidth);
                ctx.strokeStyle = "red";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(0, -weaponWidth / 2, weaponLength, weaponWidth);
                
                ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fillStyle = "white"; ctx.fill(); ctx.strokeStyle = "black"; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.restore();
                } // isBowEquipped else 종료
            }

            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                let ft = floatingTexts[i];
                ctx.fillStyle = ft.color; ctx.globalAlpha = ft.alpha;
                ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(ft.text, ft.x, ft.y);
                ft.y -= 1; ft.alpha -= 0.03; ft.timer--;
                if (ft.timer <= 0) floatingTexts.splice(i, 1); 
            }
            ctx.globalAlpha = 1.0; 

            ctx.restore(); 

            // HUD
            const hudX = 10, hudY = 10, hudW = 210, hudH = 95;
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)"; ctx.fillRect(hudX, hudY, hudW, hudH);
            ctx.fillStyle = "white"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
            ctx.fillText(`[Lv.${player.level}] ${player.name}`, hudX + 10, hudY + 10); 

            const barW = 180, barH = 10;
            let currentBarY = hudY + 30;

            ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(hudX + 15, currentBarY, barW, barH);
            ctx.fillStyle = "red"; ctx.fillRect(hudX + 15, currentBarY, barW * (Math.max(0, player.currentHp) / player.maxHp), barH);
            ctx.fillStyle = "white"; ctx.font = "10px sans-serif"; ctx.fillText(`HP: ${Math.floor(player.currentHp)}/${player.maxHp}`, hudX + 20, currentBarY - 1);
            currentBarY += 15;

            ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(hudX + 15, currentBarY, barW, barH);
            ctx.fillStyle = "yellow"; ctx.fillRect(hudX + 15, currentBarY, barW * (player.currentStamina / player.maxStamina), barH);
            ctx.fillStyle = "black"; ctx.fillText(`ST: ${Math.floor(player.currentStamina)}/${player.maxStamina}`, hudX + 20, currentBarY - 1);
            currentBarY += 15;

            ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(hudX + 15, currentBarY, barW, barH);
            ctx.fillStyle = "dodgerblue"; ctx.fillRect(hudX + 15, currentBarY, barW * (player.currentMana / player.maxMana), barH);
            ctx.fillStyle = "white"; ctx.fillText(`MP: ${Math.floor(player.currentMana)}/${player.maxMana}`, hudX + 20, currentBarY - 1);
            currentBarY += 15;

            ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(hudX + 15, currentBarY, barW, barH - 2);
            ctx.fillStyle = "limegreen"; ctx.fillRect(hudX + 15, currentBarY, barW * (player.exp / player.maxExp), barH - 2);
            ctx.fillStyle = "black"; ctx.fillText(`EXP: ${Math.floor(player.exp)}/${player.maxExp}`, hudX + 20, currentBarY - 2);

            requestAnimationFrame(gameLoop);
        }
        // [MOD-018-END]

// [MOD-023: 인트로 퀵슬롯 깜빡임 방지 즉시 실행]
(function hideVpadInstantly() {
    const vpad = document.getElementById("vpad-container");
    if (vpad && (gameState === "title" || gameState === "login" || gameState === "intro" || gameState === "lobby")) {
        vpad.style.display = "none";
    }
})();

// [MOD-019: 메인 실행부 킥오프]
gameLoop();
