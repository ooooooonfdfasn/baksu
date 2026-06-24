# baksu

`baksu`는 `(주) 백수`의 루트 사이트입니다. 예전 독립 프로젝트였던 `lunchtime`과 `hasik`을 하위 서비스로 묶어 관리합니다.

## 구조

- `index.html`: 큰 사이트의 루트 홈
- `lunchtime/`: 정적 HTML 점심시간 프로토타입
- `hasik/`: Next.js/Supabase 회식방 MVP
- `.github/workflows/pages.yml`: GitHub Pages 배포 워크플로

## 로컬 실행

루트와 점심시간 정적 화면:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

회식 Next 앱:

```bash
cd hasik
npm install
npm run dev
```

## GitHub Pages

`main` 브랜치에 푸시하면 GitHub Actions가 Pages 아티팩트를 만듭니다.

- `/`: `(주) 백수` 루트 홈
- `/lunchtime/`: 점심시간 정적 사이트
- `/hasik/`: `hasik` Next 정적 export

저장소 Pages 설정은 배포 소스를 `GitHub Actions`로 지정해야 합니다.
