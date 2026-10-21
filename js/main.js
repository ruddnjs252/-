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
                const curZoom = (typeof cameraZoom !== "undefined") ? cameraZoom : 1.0;
                let wMouseX = (mouseX / curZoom) + camera.x;
                let wMouseY = (mouseY / curZoom) + camera.y;
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

                    if ((player.activeSkillType === "charge" || player.activeSkillType === "leap_attack") && currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
                        const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
                        gobList.forEach(gob => {
                            if (!gob.active) return;
                            if (Math.hypot(nextX - gob.x, nextY - gob.y) < playerRadius + gob.size/2) {
                                const dmg = (player.stats.str * 3) + (activeSkill ? activeSkill.bonusDmg : 0);
                                applyDamageToGoblin(dmg, gob);
                            }
                        });
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

                    // [통통 튀는 바운스 걸음 타이머 계산: else 블록 내부로 안전하게 배치]
                    const actuallyMoved = (nextX !== player.x || nextY !== player.y);
                    if (isMoving && actuallyMoved) {
                        const stepSpeed = isSprinting ? 0.35 : 0.22;
                        player.walkTimer = (player.walkTimer || 0) + stepSpeed;
                    } else {
                        player.walkTimer = 0;
                    }
                }

                player.x = nextX;
                player.y = nextY;

                if (attackTimer > 0) attackTimer--;

                // [활 차징 진행 업데이트]
                if (typeof isBowCharging !== "undefined" && isBowCharging) {
                    bowChargeTime++;
                    // 50프레임(약 0.83초) 동안 게이지가 0.0 -> 1.0으로 풀 충전
                    bowChargeRatio = Math.min(1.0, bowChargeTime / 50);
                }

                // [원거리 투사체(화살) 이동, 유도 및 피격 처리]
                if (typeof projectiles !== "undefined" && projectiles.length > 0) {
                    for (let i = projectiles.length - 1; i >= 0; i--) {
                        let p = projectiles[i];

                        // ★ [추격(Homing) 인챈트 유도 비행: 가장 가까운 살아있는 고블린 탐색]
                        if (p.isHoming && currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
                            const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
                            let closestGob = null;
                            let closestDist = 500;
                            for (const g of gobList) {
                                if (!g.active || g.hp <= 0) continue;
                                const d = Math.hypot(g.x - p.x, g.y - p.y);
                                if (d < closestDist) {
                                    closestDist = d;
                                    closestGob = g;
                                }
                            }
                            if (closestGob) {
                                const targetAngle = Math.atan2(closestGob.y - p.y, closestGob.x - p.x);
                                let curAngle = Math.atan2(p.vy, p.vx);
                                let diff = targetAngle - curAngle;
                                while (diff < -Math.PI) diff += Math.PI * 2;
                                while (diff > Math.PI) diff -= Math.PI * 2;
                                const turnSpeed = 0.09;
                                const newAngle = curAngle + Math.max(-turnSpeed, Math.min(turnSpeed, diff));
                                const speed = Math.hypot(p.vx, p.vy);
                                p.vx = Math.cos(newAngle) * speed;
                                p.vy = Math.sin(newAngle) * speed;
                                p.angle = newAngle;
                            }
                        }

                        p.x += p.vx;
                        p.y += p.vy;
                        p.traveled += Math.hypot(p.vx, p.vy);

                        // 벽/장애물 충돌 검사
                        if (typeof checkObstacleCollision === "function" && checkObstacleCollision(p.x - 5, p.y - 5)) {
                            if (typeof addVisualEffect === "function") addVisualEffect(p.x, p.y, 10, "gray");
                            // 빗나간 화살은 땅에 박혀 F키/마우스로 회수 가능 (복제 화살 제외)
                            if (p.isPickable && typeof fieldItems !== "undefined") {
                                fieldItems.push({
                                    id: "arrow_drop_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                                    baseId: "arrow",
                                    count: 1,
                                    rot: 0,
                                    x: Math.max(20, Math.min(WORLD_WIDTH - 20, p.x)),
                                    y: Math.max(20, Math.min(WORLD_HEIGHT - 20, p.y))
                                });
                            }
                            projectiles.splice(i, 1);
                            continue;
                        }

                        // 던전 고블린 피격 검사 (몬스터에 박힌 화살은 회수 불가!)
                        if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
                            const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
                            let hitGob = null;
                            for (const gob of gobList) {
                                if (!gob.active || gob.hp <= 0) continue;
                                if (Math.hypot(gob.x - p.x, gob.y - p.y) < gob.size / 2 + 12) {
                                    hitGob = gob;
                                    break;
                                }
                            }
                            if (hitGob) {
                                if (typeof applyDamageToGoblin === "function") applyDamageToGoblin(p.damage, hitGob);
                                if (typeof addVisualEffect === "function") addVisualEffect(p.x, p.y, 25, "red");
                                projectiles.splice(i, 1);
                                continue;
                            }
                        }

                        // 최대 사거리 도달 또는 맵 경계 이탈 시 소멸 (사거리가 다한 화살은 땅에 박힘)
                        if (p.traveled >= p.maxDist || p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) {
                            if (p.isPickable && typeof fieldItems !== "undefined" && p.x >= 0 && p.x <= WORLD_WIDTH && p.y >= 0 && p.y <= WORLD_HEIGHT) {
                                fieldItems.push({
                                    id: "arrow_drop_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                                    baseId: "arrow",
                                    count: 1,
                                    rot: 0,
                                    x: Math.max(20, Math.min(WORLD_WIDTH - 20, p.x)),
                                    y: Math.max(20, Math.min(WORLD_HEIGHT - 20, p.y))
                                });
                            }
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

            const curZoom = (typeof cameraZoom !== "undefined") ? cameraZoom : 1.0;
            const viewW = canvas.width / curZoom;
            const viewH = canvas.height / curZoom;
            camera.x = player.x - viewW / 2;
            camera.y = player.y - viewH / 2;
            camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - viewW));
            camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - viewH));

            // === [월드 렌더링 시작 (카메라 줌인 스케일 적용)] ===
            ctx.save();
            ctx.scale(curZoom, curZoom);
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
            // 던전 맵 오브젝트 (미로 벽, 보물 상자, 포탈, 다수 고블린)
            else if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
                // 1. 던전 임시 미로 벽 렌더링
                if (Array.isArray(MAP_DATA.dungeon.walls)) {
                    MAP_DATA.dungeon.walls.forEach(w => {
                        ctx.fillStyle = "#272a36";
                        ctx.fillRect(w.x, w.y, w.w, w.h);
                        ctx.strokeStyle = "#495066";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(w.x, w.y, w.w, w.h);
                    });
                }

                // 2. 던전 귀환 포탈 렌더링
                if (MAP_DATA.dungeon.portal) {
                    const dPor = MAP_DATA.dungeon.portal;
                    ctx.fillStyle = dPor.color; ctx.fillRect(dPor.x, dPor.y, dPor.w, dPor.h);
                    ctx.strokeStyle = "#4B0082"; ctx.lineWidth = 2; ctx.strokeRect(dPor.x, dPor.y, dPor.w, dPor.h);
                    ctx.fillStyle = "white"; ctx.font = "bold 13px sans-serif";
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillText("길드 귀환", dPor.x + dPor.w/2, dPor.y - 12);
                }

                // 3. 던전 보물 상자 렌더링
                if (Array.isArray(MAP_DATA.dungeon.chests)) {
                    MAP_DATA.dungeon.chests.forEach(ch => {
                        ctx.save();
                        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                        ctx.fillRect(ch.x - 2, ch.y + 4, ch.w + 4, ch.h);

                        ctx.fillStyle = ch.opened ? "#555" : "#b8860b";
                        ctx.fillRect(ch.x, ch.y, ch.w, ch.h);
                        ctx.strokeStyle = ch.opened ? "#777" : "#ffd700";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(ch.x, ch.y, ch.w, ch.h);

                        ctx.fillStyle = ch.opened ? "#333" : "#ffe066";
                        ctx.fillRect(ch.x + ch.w / 2 - 3, ch.y + ch.h / 2 - 4, 6, 8);

                        ctx.fillStyle = ch.opened ? "#888" : "gold";
                        ctx.font = "bold 11px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(ch.opened ? "열린 상자" : "보물상자 [클릭/F]", ch.x + ch.w / 2, ch.y - 6);
                        ctx.restore();
                    });
                }

                // 4. 다수 고블린 AI 이동, 공격 및 렌더링
                const gobList = Array.isArray(MAP_DATA.dungeon.goblins) ? MAP_DATA.dungeon.goblins : (MAP_DATA.dungeon.goblin ? [MAP_DATA.dungeon.goblin] : []);
                gobList.forEach(gob => {
                    if (!gob.active) return;
                    const dx = pCenterX - gob.x, dy = pCenterY - gob.y;
                    const dist = Math.hypot(dx, dy);

                    if (gameState === "playing") {
                        if (dist > 22) {
                            let nextGx = gob.x + (dx / dist) * gob.speed;
                            let nextGy = gob.y + (dy / dist) * gob.speed;
                            if (typeof checkObstacleCollision === "function") {
                                if (!checkObstacleCollision(nextGx - gob.size/2, nextGy - gob.size/2, gob.size, gob.size)) {
                                    gob.x = nextGx; gob.y = nextGy;
                                } else if (!checkObstacleCollision(nextGx - gob.size/2, gob.y - gob.size/2, gob.size, gob.size)) {
                                    gob.x = nextGx;
                                } else if (!checkObstacleCollision(gob.x - gob.size/2, nextGy - gob.size/2, gob.size, gob.size)) {
                                    gob.y = nextGy;
                                }
                            } else {
                                gob.x = nextGx; gob.y = nextGy;
                            }
                        } else {
                            if (Math.random() < 0.04) { 
                                player.currentHp -= gob.damage;
                                addFloatingText(pCenterX, player.y - 10, gob.damage, "red");
                                if (player.currentHp < 0) player.currentHp = 0; 
                            }
                        }
                    }

                    if (player.lockedTarget === gob) {
                        ctx.beginPath();
                        ctx.arc(gob.x, gob.y, gob.size + 8, 0, Math.PI * 2);
                        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
                        ctx.lineWidth = 2.5;
                        ctx.setLineDash([4, 4]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    ctx.fillStyle = "#32CD32";
                    ctx.beginPath();
                    ctx.moveTo(gob.x, gob.y - gob.size / 2);
                    ctx.lineTo(gob.x - gob.size / 2, gob.y + gob.size / 2);
                    ctx.lineTo(gob.x + gob.size / 2, gob.y + gob.size / 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = "#1b5e20";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    const tagY = gob.y - gob.size - 18;
                    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(gob.x - 25, tagY, 50, 12);
                    ctx.fillStyle = "white"; ctx.font = "bold 9px sans-serif"; 
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillText(gob.name, gob.x, tagY + 6);
                    ctx.fillStyle = "red"; ctx.fillRect(gob.x - 25, tagY + 12, 50 * Math.max(0, gob.hp / gob.maxHp), 2.5);
                });
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

            // 플레이어 조준 각도 및 바라보는 방향 계산
            let wMouseX = (mouseX / curZoom) + camera.x;
            let wMouseY = (mouseY / curZoom) + camera.y;
            const aimAngle = Math.atan2(wMouseY - pCenterY, wMouseX - pCenterX);

            // 마우스 조준 각도에 따른 4방향 결정
            if (aimAngle >= -Math.PI / 4 && aimAngle <= Math.PI / 4) {
                player.facing = "right";
            } else if (aimAngle > Math.PI / 4 && aimAngle < 3 * Math.PI / 4) {
                player.facing = "down";
            } else if (aimAngle < -Math.PI / 4 && aimAngle > -3 * Math.PI / 4) {
                player.facing = "up";
            } else {
                player.facing = "left";
            }

            // 0. 걸을 때 통통 튀는 바운스(Bounce) 연산
            const isWalking = (typeof player.walkTimer === "number" && player.walkTimer > 0);
            const bounceY = isWalking ? -Math.abs(Math.sin(player.walkTimer)) * 5 : 0;

            // 1. 발밑 그림자 (원근감 및 입체감)
            ctx.save();
            ctx.beginPath();
            const shadowScale = isWalking ? Math.max(0.7, 1 - (Math.abs(bounceY) / 5) * 0.25) : 1;
            ctx.ellipse(pCenterX, pCenterY + 12, 14 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
            ctx.fill();
            ctx.restore();

            // [장착 무기 렌더링 함수]: 캐릭터 시선(up)에 따라 몸체 뒤/앞 레이어 분기 렌더링
            function renderEquippedWeapon() {
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
                    if (typeof isBowCharging !== "undefined" && isBowCharging) {
                        pullX = stringX - 10 - (bowChargeRatio * 16);
                    } else if (attackTimer > 0) {
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

                    // ★ [활 차징 3색 게이지 바 렌더링]
                    const barW = 7;
                    const barH = 50;
                    const barX = pCenterX + playerRadius + 10;
                    const barY = pCenterY - barH / 2;

                    ctx.save();
                    // 1. 게이지 바 배경 프레임
                    ctx.fillStyle = "rgba(15, 15, 20, 0.75)";
                    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

                    // 2. 3구간 배경 (비활성 은은한 가이드 색상)
                    ctx.fillStyle = "rgba(231, 76, 60, 0.35)";
                    ctx.fillRect(barX, barY, barW, 10);
                    ctx.fillStyle = "rgba(46, 204, 113, 0.35)";
                    ctx.fillRect(barX, barY + 10, barW, 10);
                    ctx.fillStyle = "rgba(241, 196, 15, 0.35)";
                    ctx.fillRect(barX, barY + 20, barW, 30);

                    // 구분선
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                    ctx.beginPath();
                    ctx.moveTo(barX, barY + 10); ctx.lineTo(barX + barW, barY + 10);
                    ctx.moveTo(barX, barY + 20); ctx.lineTo(barX + barW, barY + 20);
                    ctx.stroke();

                    // 3. 차징 진행 시 채워지는 게이지 바
                    const curRatio = (typeof bowChargeRatio !== "undefined") ? bowChargeRatio : 0;
                    if (curRatio > 0) {
                        const fillH = Math.min(barH, barH * curRatio);
                        const fillY = barY + barH - fillH;

                        let fillColor = "#FFD700";
                        if (curRatio >= 0.8) {
                            fillColor = "#FF3333";
                        } else if (curRatio >= 0.6) {
                            fillColor = "#00FF66";
                        }

                        if (curRatio >= 0.6 && curRatio < 0.8) {
                            ctx.shadowColor = "#00FF66";
                            ctx.shadowBlur = 8;
                        } else if (curRatio >= 0.8) {
                            ctx.shadowColor = "#FF3333";
                            ctx.shadowBlur = 8;
                        }

                        ctx.fillStyle = fillColor;
                        ctx.fillRect(barX, fillY, barW, fillH);

                        // 인디케이터 화살표
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = "#ffffff";
                        ctx.beginPath();
                        ctx.moveTo(barX + barW + 1, fillY);
                        ctx.lineTo(barX + barW + 5, fillY - 3);
                        ctx.lineTo(barX + barW + 5, fillY + 3);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.restore();
                } else {
                    const weaponLength = 48, weaponWidth = 10;
                    
                    // 방향별 캐릭터 오른손 오프셋 계산 (bounceY 연동)
                    let handOffsetX = -13, handOffsetY = 2;
                    if (player.facing === "down") {
                        handOffsetX = -13; handOffsetY = 2;
                    } else if (player.facing === "up") {
                        handOffsetX = 13; handOffsetY = 2;
                    } else if (player.facing === "right") {
                        handOffsetX = 11; handOffsetY = 3;
                    } else if (player.facing === "left") {
                        handOffsetX = -11; handOffsetY = 3;
                    }

                    const handX = pCenterX + handOffsetX;
                    const handY = pCenterY + handOffsetY + bounceY;

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
                        ctx.arc(handX, handY, weaponLength, startAngle, currentAngle);
                        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                        ctx.lineWidth = 15;
                        ctx.stroke();
                    }

                    // 검(주무기)을 장착하고 있을 때만 손에 무기 외형 렌더링
                    if (wpn) {
                        const itemData = (typeof ITEM_DB !== "undefined") ? ITEM_DB[wpn.baseId] : null;
                        const iconPath = wpn.icon || itemData?.icon;
                        const wpnImg = (typeof getItemImage === "function" && iconPath) ? getItemImage(iconPath) : null;

                        ctx.save();
                        ctx.translate(handX, handY);
                        ctx.rotate(currentAngle);
                        ctx.rotate(wristAngle);

                        if (wpnImg && wpnImg.complete && wpnImg.naturalWidth > 0) {
                            // 원본 세로 비율 1:3.13, 전체 높이 50px, 가로폭 16px
                            const drawH = 50;
                            const drawW = 16;
                            // 손잡이(자루) 중심 위치: 이미지 상단 가죽 손잡이 중심 (8px)
                            const gripY = 8;

                            // 세로 이미지의 아래쪽(칼끝)이 조준 방향(+X축)을 향하도록 -90도(반시계) 회전
                            ctx.rotate(-Math.PI / 2);
                            ctx.drawImage(wpnImg, -drawW / 2, -gripY, drawW, drawH);
                        } else {
                            // 폴백 (이미지 없거나 로딩 중일 때 기본 막대기)
                            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                            ctx.fillRect(0, -weaponWidth / 2, weaponLength, weaponWidth);
                            ctx.strokeStyle = "red";
                            ctx.lineWidth = 1.5;
                            ctx.strokeRect(0, -weaponWidth / 2, weaponLength, weaponWidth);
                        }

                        // 오른손 주먹(칼 손잡이를 쥔 손)
                        ctx.beginPath();
                        ctx.arc(0, 0, 4, 0, Math.PI * 2);
                        ctx.fillStyle = "white";
                        ctx.fill();
                        ctx.strokeStyle = "black";
                        ctx.lineWidth = 1.5;
                        ctx.stroke();

                        ctx.restore();
                    }
                } // isBowEquipped else 종료
            }

            // [Z-Order 1]: 캐릭터가 뒤돌아 서 있을 때는 몸체보다 무기를 먼저(등 뒤 레이어) 렌더링
            if (player.facing === "up" && gameState === "playing") {
                renderEquippedWeapon();
            }

            // 2. 플레이어 캐릭터 스프라이트 렌더링
            if (typeof playerSprites !== "undefined" && playerSprites.loaded) {
                ctx.save();
                ctx.imageSmoothingEnabled = false; // 도트 픽셀 아트 선명도 유지

                if (player.dashTimer > 0) {
                    ctx.globalAlpha = 0.7; // 대시 중 잔상 느낌
                }

                const renderH = 46;
                const footY = pCenterY + 14;
                const drawY = footY - renderH + bounceY;

                if (player.facing === "down") {
                    const renderW = Math.round(renderH * (380 / 480)); // 약 36px
                    ctx.drawImage(playerSprites.down, pCenterX - renderW / 2, drawY, renderW, renderH);
                } else if (player.facing === "up") {
                    const renderW = Math.round(renderH * (380 / 480)); // 약 36px
                    ctx.drawImage(playerSprites.up, pCenterX - renderW / 2, drawY, renderW, renderH);
                } else if (player.facing === "right") {
                    const renderW = Math.round(renderH * (252 / 418)); // 약 28px
                    ctx.drawImage(playerSprites.side, pCenterX - renderW / 2, drawY, renderW, renderH);
                } else if (player.facing === "left") {
                    const renderW = Math.round(renderH * (252 / 418)); // 약 28px
                    ctx.save();
                    ctx.translate(pCenterX, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(playerSprites.side, -renderW / 2, drawY, renderW, renderH);
                    ctx.restore();
                }
                ctx.restore();
            } else {
                // 스프라이트 로딩 전 폴백 (기존 원형)
                ctx.beginPath();
                ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#00a2ff"; 
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#004488"; 
                ctx.stroke();
            }

            // 무기 및 조준선 렌더링
            if (gameState === "playing") {

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

                // [Z-Order 2]: 정면이나 측면을 볼 때는 무기를 캐릭터 몸체 앞(나중에)에 렌더링
                if (player.facing !== "up") {
                    renderEquippedWeapon();
                }
            }

            // ★ [던전 60도 부채꼴 시야각 제한 및 암흑 마스킹 효과 (투명도 부여: 0.75)]
            if (currentMap === "dungeon" && gameState === "playing") {
                ctx.save();
                ctx.beginPath();
                // 1. 전체 화면을 덮는 외부 사각형
                const curZoom = (typeof cameraZoom !== "undefined") ? cameraZoom : 1.0;
                const viewW = canvas.width / curZoom;
                const viewH = canvas.height / curZoom;
                const pad = 200;
                ctx.rect(camera.x - pad, camera.y - pad, viewW + pad * 2, viewH + pad * 2);

                // 2. 플레이어 조준 각도 기준 60도 부채꼴 빛 뚫기 (사거리 420px, aimAngle +- 30도)
                const fovRadius = 420;
                const fovHalfAngle = Math.PI / 6; // 30도
                let wMouseX = (mouseX / curZoom) + camera.x;
                let wMouseY = (mouseY / curZoom) + camera.y;
                let curAimAngle = Math.atan2(wMouseY - pCenterY, wMouseX - pCenterX);

                ctx.moveTo(pCenterX, pCenterY);
                ctx.arc(pCenterX, pCenterY, fovRadius, curAimAngle - fovHalfAngle, curAimAngle + fovHalfAngle);
                ctx.closePath();

                // 3. 발밑 초근접 반경 35px 원형 조명 뚫기 (발밑 시야 확보)
                ctx.moveTo(pCenterX + 35, pCenterY);
                ctx.arc(pCenterX, pCenterY, 35, 0, Math.PI * 2);
                ctx.closePath();

                // Even-Odd 규칙으로 60도 부채꼴과 발밑을 제외한 영역을 반투명 암흑(0.75)으로 채움
                ctx.fillStyle = "rgba(6, 6, 12, 0.75)";
                ctx.fill("evenodd");

                // 시야 부채꼴 빛 테두리
                ctx.strokeStyle = "rgba(255, 230, 160, 0.25)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(pCenterX, pCenterY, fovRadius, curAimAngle - fovHalfAngle, curAimAngle + fovHalfAngle);
                ctx.stroke();

                ctx.restore();
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
