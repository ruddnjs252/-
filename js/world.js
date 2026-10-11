// [MOD-017-2: AABB 2D 사각형 충돌 계산 유틸리티]
function checkRectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// 플레이어의 다음 이동 좌표(x, y)에 지형지물(접수원, 포탈, 상자)이 있는지 미리 검사합니다.
function checkObstacleCollision(x, y) {
    if (currentMap === "guild" && typeof MAP_DATA !== "undefined") {
        const rec = MAP_DATA.guild.receptionist;
        const por = MAP_DATA.guild.portal;
        const chs = MAP_DATA.guild.personalChest;
        if (checkRectCollision(x, y, player.width, player.height, rec.x, rec.y, rec.size, rec.size)) return true;
        if (checkRectCollision(x, y, player.width, player.height, por.x, por.y, por.w, por.h)) return true;
        if (checkRectCollision(x, y, player.width, player.height, chs.x, chs.y, chs.w, chs.h)) return true;
    }
    return false;
}
// [MOD-017-END]
