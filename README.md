# 차곡 · Chagok

은행 거래내역을 가져와 PC의 SQLite에 보관하는 Electron 데스크톱 앱입니다. 실행하면 거래내역 작업 화면으로 진입합니다.

## 현재 기능

- `.xlsx` 파일 선택, 거래 양식 인식, 시트·월별 미리보기와 선택 저장
- SQLite 거래 저장, 월별 조회, 내용·메모·계좌 검색, 입금·출금·확인 필요 필터, 50건 단위 페이지
- 거래 상세에서 원본 셀 값과 파일명·시트·행 번호 확인
- 같은 계좌의 재가져오기와 겹치는 거래 중복 제외
- 마지막 정산월·메뉴 저장과 복원

별도 지출 입력, 업무 항목 분류, 배분 계산, 엑셀 내보내기와 백업·복원은 아직 구현하지 않았습니다. 입금·출금 합계와 단순 차액은 통장 흐름이며 수입·비용·배분금으로 확정한 값이 아닙니다.

## 엑셀 가져오기

1. **파일 가져오기**에서 은행의 `.xlsx` 파일을 선택합니다.
2. 계좌 이름, 시트, 가져올 월을 선택하고 누락·제외 행 안내를 확인합니다.
3. **N건 저장**을 누르면 선택한 월의 전체 거래가 저장됩니다. 미리보기는 월별 최대 5건입니다.

현재 `거래일시`, `출금`, `입금` 열이 있는 은행 양식과 `거래일자`, `출금액`, `입금액` 등의 열 이름을 지원합니다. 파일명에 적힌 월이 아닌 실제 거래일로 구분합니다. `.xls`, CSV, 암호가 걸린 엑셀, 임의 열 매핑은 지원하지 않습니다. 파일당 10MB, 시트 20개, 시트당 20,000행·64열 이하로 제한합니다.

- **계좌 이름은 중복 판단의 범위**입니다. 같은 계좌에는 같은 이름을, 다른 계좌에는 다른 이름을 사용합니다. 이름을 바꾸면 다른 계좌로 취급됩니다.
- 완전한 거래는 거래일시·금액·잔액·거래 내용 등을 대조합니다. 한 시트에 동일한 거래가 여러 번 있으면 그 건수는 보존합니다.
- 금액 또는 잔액이 불완전한 거래는 같은 파일의 같은 행일 때만 중복 제외합니다. 다른 파일의 불완전한 거래를 임의로 합치지 않습니다.
- 누락·잘못된 금액은 `null`과 확인 사유로 저장하고 실제 0원과 구분합니다. 입출금이 모두 양수인 행도 확인 대상으로 표시합니다.
- 거래일시가 잘못된 행은 미리보기에서 알리고 저장 대상에서 제외합니다. 파일 하단 합계는 거래로 가져오지 않습니다.
- 원본 셀 값, 파일명, SHA-256, 시트·행 번호와 가져오기 결과를 보관합니다. 원본 XLSX 파일 자체를 별도로 복사하지는 않습니다.
- 저장은 트랜잭션 단위입니다. 도중에 오류가 나면 해당 가져오기 전체를 취소하고 미리보기에서 다시 시도할 수 있습니다.

## 데이터 저장

- 위치: Electron `app.getPath("userData")/storage/chagok.sqlite`. 설치 폴더·Chromium 캐시와 분리합니다.
- 메인 프로세스의 내장 `node:sqlite`를 사용합니다. 서버 없이 실행합니다.
- 스키마 v1: `workspace_preferences`. v2: `transaction_imports`, `bank_transactions`. 기존 설정을 보존하며 트랜잭션으로 마이그레이션합니다.
- WAL, `synchronous=FULL`, 외래 키·고유 제약과 매개변수 SQL을 사용합니다.
- 렌더러에는 허용한 IPC 기능만 노출합니다. 임의 경로나 SQL은 전달하지 않습니다.
- 이전 localStorage 설정은 한 번 이관하며 새 값은 SQLite에 저장합니다. 저장 실패는 UI에 표시하고 재시도를 제공합니다.
- DB를 열지 못하면 기존 파일을 보존합니다. 자동으로 삭제하거나 초기화하지 않습니다.
- 금융 원본, DB 및 WAL/SHM 파일, 백업, `.env`, 테스트 산출물은 Git에서 제외합니다.

## 구조

`lightlink-ontime-nextjs`의 `atomics / domains / shared` 구분을 유지합니다.

```text
src/
  app/                         React 진입점과 전역 테마
  atomics/
    atoms/                     공식 shadcn 컴포넌트 (CLI로 생성)
    molecules/                 MonthSelector 등 도메인 중립 UI 조합
    templates/                 WorkspaceLayout 등 레이아웃 조합
  domains/
    dashboard/                 차곡 메뉴, 작업 화면과 설정 상태
    transactions/              거래 목록·상세·가져오기 UI, 조회 훅, 순수 은행 양식 파서
    expenses/                  별도 지출 타입
    settlement/                정산·배분 타입
  shared/                      IPC 계약, 공통 타입·훅·유틸리티
  main/imports/                파일 선택 후 읽기와 미리보기 세션
  main/storage/                SQLite 마이그레이션과 저장소
  preload/                     제한된 IPC 브리지
```

기본 UI는 공식 shadcn `base-nova` 레지스트리 소스를 사용합니다. 새로운 기본 컴포넌트는 `pnpm exec shadcn add <이름>`으로 추가하며 `components.json`이 `atomics/atoms`에 배치합니다. 도메인 컴포넌트는 이 UI를 조합하고, `atomics`와 `shared`는 `domains`나 `app`에 의존하지 않습니다. ESLint로 경계를 검사합니다.

TanStack Query는 사용하지 않습니다. 도메인 훅이 IPC 요청, 로딩·오류·재조회와 오래된 응답 무시를 관리합니다. 파일과 DB 접근은 main에 둡니다. 경로 별칭은 `@/* → src/*`입니다.

## 실행과 검증

Node.js 22.13 이상, pnpm 10.26.1을 사용합니다.

```sh
corepack enable
pnpm install
pnpm dev
```

```sh
pnpm lint           # 코드와 의존성 경계
pnpm type-check     # Electron / React 타입 검사
pnpm format:check
pnpm build
pnpm start
pnpm test:smoke     # 실제 Electron에서 설정·이관·저장 실패·재시작 검증
pnpm test:imports   # 실제 XLSX와 SQLite로 가져오기·중복·기간·롤백·검색·복원 검증
pnpm build:dir      # Windows 실행 폴더
pnpm build:win      # Windows NSIS 설치 파일
```

테스트는 매번 별도의 프로필과 합성 엑셀을 만들며 실제 사용자 DB를 건드리지 않습니다. 로컬에서 `CHAGOK_EXAMPLE_XLSX` 환경 변수를 지정하면 해당 첨부 파일도 격리된 프로필에서 검증합니다. 실제 원본은 저장소에 포함하지 않습니다.

Windows CI 템플릿은 `docs/windows-ci.example.yml`입니다. 자동 실행은 Workflow 쓰기 권한이 있는 인증으로 `.github/workflows/ci.yml`에 복사해 활성화합니다. 배포용 코드 서명과 아이콘은 아직 설정하지 않았습니다.
