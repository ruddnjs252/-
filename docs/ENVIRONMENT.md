# UTU 개발 환경 및 실행 가이드 (ENVIRONMENT.md)

> **문서 목적**: 노트북(Windows)과 Android 태블릿(Termux + Debian 12 ARM64 + XFCE + Antigravity) 환경에서 프로젝트를 설정, 실행, 테스트할 때 필요한 정보와 환경별 주의사항을 제공합니다.

---

## 1. 프로젝트 기술 스택 및 구조

- **코어 기술**: 순수 웹 표준 기술 (HTML5 Canvas 2D API, Vanilla JavaScript, CSS3)
- **외부 의존성 (Dependencies)**: **없음 (0개)**
  - `npm`, `yarn`, `pnpm` 등 패키지 매니저 불필요
  - Webpack, Vite 등의 번들러나 트랜스파일러 빌드 과정 불필요
  - 브라우저만 있으면 즉시 실행 가능
- **데이터 영속성**: 브라우저 `localStorage` (첫 방문 안내창 체크 등에 사용)

---

## 2. 노트북 개발 환경 (Windows)

- **OS**: Windows 11
- **에디터**: Antigravity IDE / VS Code
- **브라우저**: Google Chrome, Microsoft Edge 권장

### 실행 방법
1. **VS Code Live Server (가장 권장)**:
   - 에디터에서 `index.html` 우클릭 &rarr; `Open with Live Server` 클릭.
   - 코드 수정 시 브라우저가 자동으로 새로고침되어 가장 쾌적합니다.
2. **Python 내장 웹 서버**:
   ```powershell
   python -m http.server 8080
   ```
   - 브라우저에서 `http://localhost:8080` 접속.
3. **직접 파일 열기**:
   - 파일 탐색기에서 `index.html`을 더블 클릭하여 브라우저로 열기.
   - (주의: 일부 브라우저 보안 정책에 따라 이미지 에셋 로딩에 제한이 있을 수 있으므로 로컬 서버 실행을 권장합니다.)

---

## 3. Android 태블릿 개발 환경 (Android + Termux + Debian 12 ARM64)

### 3.1 환경 사양
- **기반 OS**: Android
- **터미널 계층**: Termux
- **리눅스 컨테이너**: Debian 12 (ARM64 아키텍처)
- **데스크톱 환경**: XFCE
- **개발 도구**: Antigravity IDE

---

### 3.2 태블릿에서 프로젝트 가져오기 (Git Clone)

Termux 또는 Debian 12 터미널 환경에서 아래 명령어를 실행합니다:

```bash
# 원하는 작업 디렉터리로 이동
cd ~/workspace

# GitHub 저장소 복제 (기존 URL 연결)
git clone https://github.com/ruddnjs252/-.git UTU

# 프로젝트 디렉터리 이동
cd UTU

# 상태 확인
git status
```

---

### 3.3 태블릿에서의 실행 방법

#### 방법 1: Python 로컬 HTTP 서버 실행 (가장 권장)
브라우저의 `file://` 보안 정책(로컬 이미지 로딩 CORS 제한)을 회피하고 실제 웹 환경과 동일하게 구동하는 가장 안정적인 방법입니다.

```bash
# UTU 디렉터리 내부에서 실행
python3 -m http.server 8080
```
- **접속 방법**:
  - Debian XFCE 내부 브라우저(Firefox-ESR 또는 Chromium)에서 `http://localhost:8080` 접속
  - 또는 안드로이드 외부 네이티브 브라우저(Chrome/Samsung Internet)에서 `http://localhost:8080` 접속

#### 방법 2: Antigravity 내장 웹 브라우저/프리뷰 도구
- [검증 필요] 태블릿용 Antigravity IDE 내부에서 `index.html`의 실시간 프리뷰 기능 지원 여부 및 포트 포워딩 상태는 실기 환경에서 확인이 필요합니다.

#### 방법 3: XFCE 파일 관리자(Thunar)에서 직접 열기
- [검증 필요] Thunar에서 `index.html`을 브라우저로 직접 열었을 때, `new Image()`로 로드되는 로컬 스프라이트 파일들이 브라우저 보안 제약 없이 캔버스에 정상 출력되는지 검증이 필요합니다.

---

### 3.4 태블릿 환경 개발 시 주의사항

1. **터치 입력 및 가상패드(VPad) 동작**:
   - 물리 마우스/키보드가 연결되지 않은 터치 전용 환경에서는 화면 좌측 하단의 가상 조이스틱과 우측 퀵슬롯이 즉시 활성화되어야 합니다.
   - 캔버스 터치 좌표 계산 시 CSS 크기와 캔버스 내부 해상도(`canvas.width`, `canvas.height`) 간의 비율 보정(`getBoundingClientRect()`)이 태블릿 해상도에서도 어긋나지 않는지 확인해야 합니다.
2. **뷰포트 제스처 방지**:
   - 게임 도중 두 손가락 핀치 줌(확대)이나 더블 탭 확대가 일어나지 않도록 메타 태그(`maximum-scale=1.0, user-scalable=no`)가 적용되어 있습니다.
3. **성능 및 발열**:
   - ARM64 에뮬레이션 또는 chroot 환경 특성상 캔버스 렌더링 프레임(FPS)이 저하될 수 있으므로, 불필요한 루프 내 객체 생성이나 과도한 이펙트 연산은 피해야 합니다.

---

## 4. 환경 간 작업 전환(인수인계) 워크플로우

노트북과 태블릿을 번갈아 사용할 때 작업 순서:

```
[노트북에서 작업 마칠 때]
1. docs/DEVELOPMENT_LOG.md 및 docs/PROJECT_STATUS.md 최신 상태 갱신
2. git add .
3. git commit -m "작업 내용 요약"
4. git push origin main

               ▼ (GitHub 원격 저장소 동기화)

[태블릿에서 작업 시작할 때]
1. cd UTU && git pull origin main
2. docs/PROJECT_STATUS.md 와 docs/DEVELOPMENT_LOG.md 읽기
3. 작업 계획 수립 후 대화 우선 규칙에 따라 진행
```
