# 사학도생의 추천 역사투어 (2단계 · API 호출)

제주 역사문화 데이터를 **공공데이터포털 오픈API**로 불러와, 테마 코스와 지도로 보여주는 사이트예요.

## 구조

```
index.html        화면 (브라우저가 /api/places 를 호출해요)
tours.js          사학도생이 고른 추천 코스 6개 (화면에 보여줄 글)
api/places.js     Vercel 서버리스 함수: 공공데이터포털 API 2개를 호출해 합쳐서 JSON 으로 응답
dev-server.js     내 컴퓨터 미리보기용 (npm run dev)
```

- 위치정보(15109570) + 일반정보(15109587) 두 API 를 서버가 호출해 `데이터 고유번호`로 합쳐요.
- **인증키는 코드에 없어요.** 환경변수 `DATA_GO_KR_KEY` 로만 읽어요.

## 환경변수

| 이름 | 값 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 일반 인증키 (두 데이터 모두 활용신청 승인 필요) |

## 배포 (Vercel)

1. GitHub 에 올려요. (`.env` 가 올라가지 않았는지 꼭 확인!)
2. Vercel 에서 그 GitHub 저장소를 Import 해요. Framework Preset 은 **Other**, 설정은 기본값 그대로예요.
3. **Settings > Environment Variables** 에 `DATA_GO_KR_KEY` 를 넣고 (Production·Preview·Development 모두 체크) **Redeploy** 해요.
4. 배포된 주소로 접속해 코스가 보이는지 확인해요. (시크릿 창 `Ctrl + Shift + N` 권장)

## 내 컴퓨터에서 미리보기

```bash
# PowerShell
$env:DATA_GO_KR_KEY = "내 키"
npm run dev
```

→ http://localhost:3000
