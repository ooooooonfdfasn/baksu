# hasik

익명 직장인 롤플레잉 기반의 실시간 회식방 MVP입니다.

이제 `hasik`은 루트 저장소 `baksu` 안의 하위 서비스로 관리됩니다.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Realtime
- AWS Amplify Hosting

## Local Development

```bash
npm install
npm run dev
```

Supabase 환경변수가 없으면 로컬 데모 모드로 동작합니다.

휴대폰에서 로컬 개발 서버를 볼 때는 휴대폰의 `localhost`가 아니라 Mac의 네트워크 IP를 사용합니다.

현재 이 Mac의 Wi-Fi IP 예시:

```text
http://192.168.0.17:3000
```

IP는 Wi-Fi가 바뀌면 달라질 수 있습니다. 다시 확인하려면 Mac에서 `ifconfig`를 보고 활성 Wi-Fi 인터페이스의 `inet` 값을 사용하세요.

Mac과 휴대폰이 같은 Wi-Fi에 있어야 하며, 휴대폰이 셀룰러/VPN/게스트 Wi-Fi에 있거나 공유기에서 기기 간 통신을 막으면 접속되지 않을 수 있습니다.

## Supabase Realtime

실시간 채팅 저장을 켜려면 [docs/supabase-setup.md](docs/supabase-setup.md)를 따라 Supabase SQL과 `.env.local`을 설정합니다.

## GitHub Pages Export

루트 저장소의 GitHub Actions 워크플로가 `npm run build:pages --prefix hasik`을 실행해 `/hasik/` 경로로 정적 export를 배포합니다.

로컬에서 확인할 때:

```bash
npm run build:pages
```
