// [MOD-010: 게임 엔진 초기화 및 전역 변수 선언]
// [MOD-010-1: 캔버스 및 카메라 설정]
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WORLD_WIDTH = 3000;  // 전체 월드의 가로 크기
const WORLD_HEIGHT = 3000; // 전체 월드의 세로 크기
let camera = { x: 0, y: 0, width: 1000, height: 750 }; // 카메라 뷰포트 영역

// 창 크기 변경 시 캔버스 해상도를 동기화하여 깨짐 방지
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width;
    camera.height = canvas.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// [MOD-010-2: 게임 상태 및 플레이어 데이터 객체]
let gameState = "playing"; 
let currentMap = "guild";  

let player = {
    name: "방랑자",
    x: 500, y: 500, width: 30, height: 30, color: "cyan", speed: 5, 
    stats: { hp: 3, str: 3, dex: 3, mana: 3, stamina: 3, charm: 3 }, 
    baseStats: { hp: 3, str: 3, dex: 3, mana: 3, stamina: 3, charm: 3 }, // <-- [핵심 수정] 한글 스탯명을 모두 영어로 통일!
    equipment: { 
        head: null, mainWeapon: null, chest: null, subWeapon: null, shoes: null, throwable: null,
        artifact_0: null, artifact_1: null, artifact_2: null, artifact_3: null, artifact_4: null
    },
    job: "무소속", 
    acquiredJobs: [], 
    currentSkillIdx: 0,
    skillCooldowns: {}, 
    level: 1, exp: 0, maxExp: 100, 
    maxHp: 9, currentHp: 9, 
    maxStamina: 9, currentStamina: 9, staminaRegenTimer: 0, 
    maxMana: 9, currentMana: 9, 
    knockbackDirX: 0, knockbackDirY: 0, 
    dashSpeed: 0, dashDirX: 0, dashDirY: 0, dashTimer: 0, 
    targetX: 0, targetY: 0, 
    activeSkillType: null, 
    aimingSkill: null, 
    currentQuickSlotIdx: 0, 
    lockedTarget: null 
};

// [MOD-010-3: 시스템, 퀘스트, 이펙트 등 전역 관리 변수]
let quest = { active: false, target: 10, current: 0 }; // 퀘스트 진행 상태
let floatingTexts = []; // 데미지, 타겟팅 텍스트 등 공중에 뜨는 글자 관리
let visualEffects = []; // 스킬 타격 이펙트 (원형 파티클 등) 관리
let projectiles = []; // 원거리 발사체(화살 등) 관리
let inventory = []; // 플레이어 가방 (그리드 연동)
let equipment = []; // 장착 중인 장비
let personalStorage = []; // 창고 보관 아이템

// [신규] 필드 바닥에 떨어진 아이템 및 현재 타겟팅 중인 아이템 보관 변수
let fieldItems = []; 
let targetedFieldItem = null; 

let totalFreePoints = 30; // 캐릭터 생성 시 주어지는 잔여 스탯 포인트
let tempSelectedJobs = []; // 캐릭터 생성 시 임시로 선택한 직업 목록

let mouseX = 0, mouseY = 0; // 월드 좌표계 기준 마우스 위치
let attackTimer = 0; // 기본 공격 쿨타임 및 무기 스윙 애니메이션 프레임 제어
let isBowCharging = false; // 활 좌클릭 차징 중 여부
let bowChargeTime = 0; // 활 차징 프레임 타이머
let bowChargeRatio = 0; // 활 차징 게이지 비율 (0.0 ~ 1.0)
let keys = {}; // 키보드 입력 상태 저장 객체
const statKeys = ["hp", "str", "dex", "mana", "stamina", "charm"];
// [MOD-010-END]
