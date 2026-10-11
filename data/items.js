// [ITEM-001-START] 아이템 기본 정적 데이터베이스 (ITEM_DB)
const ITEM_DB = {
    // [기본 검]: 주무기(mainWeapon) 전용, 힘 +5, 소켓 3칸
    "sword_basic":  { 
        name: "기본 검", 
        type: "equip", 
        equipSlot: "mainWeapon", 
        shape: [[1],[1],[1]], 
        color: "rgba(120, 120, 150, 0.9)", 
        stats: { str: 5 }, 
        maxSockets: 3,
        desc: "모험가들이 널리 사용하는 기본 검이다."
    }, 
    // [철갑옷]: 장비(equip) 타입 지정, 갑옷 슬롯(chest) 전용, 체력(hp) +10, 소켓 2칸
    "armor_iron":   { 
        name: "철갑옷", 
        type: "equip", 
        equipSlot: "chest", 
        shape: [[1, 1], [1, 1]], 
        color: "rgba(80, 80, 80, 0.9)", 
        stats: { hp: 10 }, 
        maxSockets: 2,
        desc: "단단한 철판을 덧대어 만든 묵직한 갑옷이다."
    },    
    // [소비 아이템]: 포션
    "potion_hp":    { 
        name: "포션", 
        type: "potion", 
        shape: [[1]], 
        color: "rgba(200, 50, 50, 0.9)",
        desc: "체력을 회복시켜 주는 붉은 물약이다."
    }, 
    // [ㄱ자 도끼]: 주무기(mainWeapon) 전용
    "axe_battle":   { 
        name: "ㄱ자 도끼", 
        type: "equip", 
        equipSlot: "mainWeapon", 
        shape: [[1, 1], [1, 0], [1, 0]], 
        color: "rgba(180, 100, 50, 0.9)",
        desc: "독특한 모양으로 제작된 강력한 전투 도끼다."
    },
    // [초보자 지팡이]: 주무기(mainWeapon) 전용, 마나 +8, 소켓 2칸
    "wand_basic":   {
        name: "초보자 지팡이", 
        type: "equip", 
        equipSlot: "mainWeapon", 
        color: "#8B4513", 
        shape: [[1],[1],[1]], 
        stats: { str: 0, mana: 8 }, 
        maxSockets: 2, 
        desc: "마력을 집중하기 좋은 튼튼한 나무 지팡이."
    },
    // [인챈트 두루마리]: 장비 소켓 강화용
    "scroll_smite": { 
        name: "강타 두루마리", 
        type: "enchant", 
        shape: [[1]], 
        color: "#ff4444", 
        enchantEffect: { stat: "str", value: 5, name: "강타(+5)" },
        desc: "무기에 바르면 힘을 대폭 올려주는 주문서다."
    },
    // ★ 신규 아이템: 스킬북
    "book_teleport": { 
        name: "스킬북: 순간이동", 
        type: "skillbook", 
        skillId: "teleport",
        shape: [[1]], 
        color: "rgba(100, 50, 200, 0.9)", 
        desc: "사용 시 [순간이동] 스킬을 습득한다.<br><span style='color:gold;'>(PC: 더블클릭 / 모바일: 두번 연속 터치)</span>"
    }
};
// [ITEM-001-END]
