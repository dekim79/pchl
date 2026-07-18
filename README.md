# PCHL — Phase Change Heat Transfer Lab

Chung-Ang University, School of Energy System Engineering 소속 PCHL(Phase Change Heat Transfer Lab)
연구실 공식 웹사이트 소스입니다. 순수 HTML/CSS/JS로 제작되어 별도 빌드 과정 없이
GitHub Pages 등 정적 호스팅에 바로 배포할 수 있습니다.

## 페이지 구성

| 파일 | 페이지 |
| --- | --- |
| `index.html` | Home |
| `pi.html` | PI (지도교수 소개) |
| `members.html` | Members (구성원 / 졸업생) |
| `research.html` | Research (연구 주제 / 연구 역량) |
| `publications.html` | Publications (국제학술지 논문 / 특허) |
| `current-issues.html` | Current Issues (진행 중 이슈) |
| `news.html` | News (소식 / 일정) |

## 폴더 구조

```
.
├── index.html / pi.html / members.html / research.html / publications.html / current-issues.html / news.html
├── assets/
│   ├── css/style.css       공통 스타일시트
│   ├── js/main.js          모바일 메뉴 등 공통 스크립트
│   └── img/
│       ├── members/        구성원 사진
│       ├── research/       연구 관련 이미지
│       ├── news/           뉴스/소식 이미지
│       └── misc/           로고, 배경 이미지
└── source/                 원본 자료(사진·PDF) — 사이트에는 직접 사용되지 않는 원본 보관용
```

## 로컬에서 확인하기

별도 서버 없이 `index.html`을 브라우저로 열면 됩니다. 다만 상대 경로 리소스가
정상적으로 로드되도록 간단한 정적 서버 사용을 권장합니다.

```bash
python -m http.server 8000
# http://localhost:8000 접속
```

## GitHub Pages로 배포하기

1. 이 저장소를 GitHub에 push 합니다.
2. GitHub 저장소 **Settings → Pages** 에서 Source를 `main` 브랜치, `/ (root)` 폴더로 지정합니다.
3. 잠시 후 `https://<username>.github.io/<repo>/` 주소로 접속할 수 있습니다.
4. 커스텀 도메인(`www.heatdekim.kr` 등)을 연결하려면 Pages 설정에서 Custom domain을 입력하고,
   도메인 등록기관(DNS)에 CNAME/A 레코드를 설정합니다.

## 내용 업데이트 방법

- **구성원 추가/변경**: `members.html`의 `person-card` 블록을 복사해 사진(`assets/img/members/`)과
  이름·이메일·연구분야를 수정합니다.
- **논문 추가**: `publications.html`의 해당 연도 `pub-list`에 `pub-item`을 추가합니다.
- **뉴스 추가**: `news.html`의 `news-gallery`에 사진과 날짜를 추가합니다.
- **PI 사진**: 현재 PI 사진 파일이 없어 이니셜(DEK) 플레이스홀더로 표시됩니다.
  `assets/img/misc/`에 사진을 추가한 뒤 `pi.html`의 `.pi-photo` 블록을 `<img>` 태그로 교체하세요.
