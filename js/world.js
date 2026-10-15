// [MOD-017-2: AABB 2D 사각형 충돌 계산 유틸리티]
function checkRectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// 플레이어 또는 투사체의 다음 이동 좌표(x, y)에 지형지물(접수원, 포탈, 상자, 던전 미로 벽)이 있는지 검사합니다.
function checkObstacleCollision(x, y, w, h) {
    const boxW = (typeof w !== "undefined") ? w : (typeof player !== "undefined" ? player.width : 30);
    const boxH = (typeof h !== "undefined") ? h : (typeof player !== "undefined" ? player.height : 30);

    if (currentMap === "guild" && typeof MAP_DATA !== "undefined") {
        const rec = MAP_DATA.guild.receptionist;
        const por = MAP_DATA.guild.portal;
        const chs = MAP_DATA.guild.personalChest;
        if (checkRectCollision(x, y, boxW, boxH, rec.x, rec.y, rec.size, rec.size)) return true;
        if (checkRectCollision(x, y, boxW, boxH, por.x, por.y, por.w, por.h)) return true;
        if (checkRectCollision(x, y, boxW, boxH, chs.x, chs.y, chs.w, chs.h)) return true;
    } else if (currentMap === "dungeon" && typeof MAP_DATA !== "undefined" && MAP_DATA.dungeon) {
        // 던전 귀환 포탈 본체는 장애물로 막지 않고 통과하여 클릭/상호작용 가능
        // 던전 미로 벽돌 충돌 검사
        if (Array.isArray(MAP_DATA.dungeon.walls)) {
            for (let i = 0; i < MAP_DATA.dungeon.walls.length; i++) {
                const wall = MAP_DATA.dungeon.walls[i];
                if (checkRectCollision(x, y, boxW, boxH, wall.x, wall.y, wall.w, wall.h)) {
                    return true;
                }
            }
        }
    }
    return false;
}
// [MOD-017-END]
