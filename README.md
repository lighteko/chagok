# 차곡 · Chagok

거래내역과 별도 지출을 차곡차곡 모아 월별 장부와 정산을 만드는 로컬 데스크톱 앱.

한 명이 한 PC에서 사용하는 업무를 기준으로 시작합니다. 현재는 Electron 실행 환경, React 시작 화면, 타입이 지정된 IPC, 도메인 구조와 개발 검증 도구까지 구성한 초기 프로젝트입니다. 엑셀 분석, 지출 저장, 정산 계산은 아직 구현하지 않았습니다.

## 실행

Node.js 22.12 이상과 pnpm 10.26.1을 사용합니다.

```sh
corepack enable
pnpm install
pnpm dev
```

```sh
pnpm lint          # 코드와 계층 의존성 검사
pnpm type-check    # Electron / React 타입 검사
pnpm format:check  # 포맷 검사
pnpm build         # 프로덕션 빌드
pnpm start         # 빌드한 앱 실행
pnpm test:smoke    # Windows에서 실제 Electron 실행 및 IPC 검증
pnpm build:dir     # 설치 전 실행 폴더 생성
pnpm build:win     # Windows NSIS 설치 파일 생성
```

처음 생성하는 설치 파일에는 코드 서명이 설정되어 있지 않습니다. 배포 시 코드 서명과 앱 아이콘을 설정합니다.

Windows CI 템플릿은 `docs/windows-ci.example.yml`에 있습니다. 자동 검증을 활성화하려면 GitHub Workflow 쓰기 권한이 있는 인증으로 `.github/workflows/ci.yml`에 복사해 커밋합니다.

## 구조

`lightlink-ontime-nextjs`의 도메인 분리, Atomic Design, 공통 계층, Query 래퍼, 경로 별칭과 포맷 규칙을 따릅니다. 데스크톱 앱의 화면은 React + Vite로 실행합니다.

```text
src/
  main/               Electron 앱 수명주기와 OS 접근
  preload/            허용한 기능만 노출하는 브리지
  app/                화면 진입점, Provider, 전역 스타일
  atomics/
    atoms/            UI 기본 요소
    molecules/        UI 조합
    templates/        레이아웃
  domains/
    dashboard/        시작 화면과 앱 상태 조회 예제
    transactions/     원본 거래 및 분류 타입
    expenses/         직접 입력하는 지출 타입
    settlement/       정산 기간 및 배분 규칙 타입
  shared/
    desktop/          main/preload/renderer 공통 IPC 계약
    query/            useApi 래퍼와 QUERY_KEYS
    utils/            도메인과 무관한 유틸리티
  types/              Window 브리지 타입
```

- 업무 로직은 `domains`에 둡니다.
- `shared`와 `atomics`는 `domains`와 `app`을 import하지 않습니다. ESLint가 이 경계를 검사합니다.
- 경로 별칭은 `@/* → src/*`입니다.
- TanStack Query는 `useApiQuery`, `useApiMutation`, `useApiInfiniteQuery`를 통해 사용하고, 쿼리 키는 `QUERY_KEYS`에서 관리합니다.
- 파일 접근과 향후 DB 작업은 main에 둡니다. renderer는 `window.chagok`의 제한된 API만 사용합니다.
- `contextIsolation`, sandbox, CSP, IPC 호출자 검사, 외부 탐색 차단을 기본 적용합니다.

## 업무 설계

- 원본 거래는 보존하고 정산 분류와 월 배정은 별도로 관리합니다.
- 금액 누락은 `null`이며 실제 0원과 구분합니다. 금액 단위는 원입니다.
- 통장에 없는 지출은 별도로 입력하며, 통장 거래와 연결해 중복 집계를 방지합니다.
- 카드 사용액과 카드대금 출금이 함께 있으면 이중 비용 처리를 방지해야 합니다.
- 정산월은 파일명이 아니라 거래일과 업무 기준으로 결정합니다.
- 통장 잔액과 정산 잔액은 다른 지표로 관리합니다.
- 기존 양식의 80:20 배분은 변경 가능한 규칙으로 구현합니다. 배분 시 반올림 및 나머지 원 처리 기준을 먼저 확정합니다.

## 다음 구현 순서

1. 완성된 정산표와 거래내역 한 쌍으로 분류·기간·배분 기준 확정.
2. 로컬 저장소, 변경 이력, 백업·복원.
3. 은행 엑셀 읽기, 기간 선택, 누락 확인, 재업로드 중복 검토.
4. 직접 지출 입력과 분류 규칙, 통장 거래 연결.
5. 월별 집계와 클릭 가능한 도표, 마감, 기존 양식 엑셀 출력.

금융 원본 파일, `.env`, 로컬 DB, 백업은 Git에서 제외합니다. 첨부받은 실제 정산 자료를 저장소에 넣지 않습니다.
