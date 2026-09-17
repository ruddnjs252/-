// [JOB-001-START] 직업 목록 및 기본 공격/스킬 판정 데이터
const JOB_DATA = [
    { 
        name: "견습 기사", req: [], type: "basic", desc: "기본 기사 계열 시작 직업", usesMana: false,
        normal: { name: "베기", bonusDmg: 5, spread: Math.PI / 2, range: 60, desc: "부채꼴 공격 (힘×3 + 5)" },
        skill: { id: "leap_only", name: "도약", type: "leap_only", cooldown: 1.5, desc: "전방으로 도약 이동 (거리: 90px, 쿨 1.5초)" }
    },
    { 
        name: "기사", req: ["hp", "str"], reqVal: 6, type: "basic", desc: "요구: 체력 6, 힘 6", usesMana: false,
        normal: { name: "강화 베기", bonusDmg: 10, spread: (Math.PI * 2) / 3, range: 75, desc: "넓은 부채꼴 공격 (힘×3 + 10)" },
        skill: { id: "leap_attack", name: "도약 베기", type: "leap_attack", bonusDmg: 20, cooldown: 5, desc: "전방으로 도약하며 경로 관통 베기 (거리: 90px, 피해: 힘×3 + 20, 쿨 5초)" }
    },
    { 
        name: "광전사", req: ["str"], reqVal: 15, type: "special", desc: "요구: 힘 15 (성장 후 전직)", usesMana: false,
        normal: { name: "광범위 휘두르기", bonusDmg: 15, spread: Math.PI, range: 90, desc: "반원 휘두르기 (힘×3 + 15)" },
        skill: { id: "jump_slam", name: "뛰어들기", type: "jump_slam", bonusDmg: 50, cooldown: 7.5, desc: "마우스 위치 도약 광역 강타 (힘×3 + 50, 쿨 7.5초)" }
    },
    { 
        name: "성기사", req: ["hp"], reqVal: 10, type: "special", desc: "요구: 체력 10 (신앙무기 소지)", usesMana: false,
        normal: { name: "집중 베기", bonusDmg: 10, spread: Math.PI / 3, range: 80, desc: "집중된 부채꼴 공격 (힘×3 + 10)" },
        skill: { id: "charge", name: "돌진", type: "charge", bonusDmg: 30, cooldown: 5, desc: "마우스 위치까지 직선 돌진 (힘×3 + 30, 쿨 5초)" }
    }
];
// [JOB-001-END]
