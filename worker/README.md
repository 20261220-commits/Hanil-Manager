# AI 중계 서버 올리기 (Cloudflare Workers, 무료)

교사 프로필 글을 AI(Gemini)가 읽고 특성과 이벤트를 만들게 하는 서버입니다.
Gemini API 키는 이 서버에만 저장되고, 게임을 하는 친구들 브라우저에는 가지 않습니다.
서버가 없어도 게임은 키워드 규칙으로 동작합니다.

필요한 것: 컴퓨터에 [Node.js](https://nodejs.org) (LTS 버전), 구글 계정, Cloudflare 계정 (무료)

## 1. Gemini API 키 만들기

1. https://aistudio.google.com 에 구글 계정으로 들어갑니다.
2. **Get API key → API 키 만들기**를 누르고 키를 복사해 둡니다.
3. 무료 사용량과 조건(무료 사용분의 입력이 서비스 개선에 쓰일 수 있음 등)은 그 페이지에서 확인해 주세요.

키는 다른 사람에게 보여 주거나 GitHub에 올리지 마세요.

## 2. Cloudflare 가입

https://dash.cloudflare.com/sign-up 에서 무료로 가입합니다. 카드 등록은 필요 없습니다.

## 3. 서버 올리기

터미널에서 이 저장소의 `worker` 폴더로 이동한 뒤 차례로 실행합니다.

```bash
cd worker
```

```bash
npx wrangler login
```

브라우저가 열리면 Cloudflare 로그인을 허락합니다.

`wrangler.toml`을 열어 `ALLOWED_ORIGINS`의 `YOUR-ID`를 내 GitHub 아이디로 바꿉니다.
(예: `https://20261220-commits.github.io,https://claude.ai`)

Gemini 키를 서버 비밀 값으로 넣습니다. 실행하면 키를 붙여 넣으라고 묻습니다.

```bash
npx wrangler secret put GEMINI_API_KEY
```

친구 코드(암호)를 쓰려면 이것도 넣습니다. 쓰지 않으면 건너뜁니다.

```bash
npx wrangler secret put FRIEND_CODE
```

서버를 올립니다.

```bash
npx wrangler deploy
```

끝나면 `https://hanil-manager-ai.<내 서브도메인>.workers.dev` 같은 주소가 나옵니다.

## 4. 확인

브라우저에서 `서버 주소/health`를 열어 `{"ok":true,...}`가 보이면 성공입니다.

## 5. 게임에 연결

- 모두가 같은 서버를 쓰게 하려면 `js/config.js`의 `AI_SERVER`에 주소를 넣고 다시 올립니다.
- 사람마다 따로 넣으려면 게임 **설정 → AI 서버**에 주소(와 친구 코드)를 넣고 **연결 확인**을 누릅니다.

"허용되지 않은 주소에서 온 요청입니다 (주소)"라는 오류가 나오면, 괄호 안 주소를 `ALLOWED_ORIGINS`에 추가하고 `npx wrangler deploy`를 다시 실행합니다.

## (선택) 사용량을 정확히 세기

기본 설정에서는 사용량을 서버 메모리에 대략 셉니다. 정확히 세려면 KV 저장소를 만듭니다.

```bash
npx wrangler kv namespace create LIMITS
```

나온 `id`를 `wrangler.toml` 아래쪽 주석을 푼 `[[kv_namespaces]]`에 넣고 다시 `npx wrangler deploy` 합니다.

## 설정 값

| 이름 | 종류 | 뜻 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 비밀 값 (필수) | Gemini API 키 |
| `FRIEND_CODE` | 비밀 값 (선택) | 이 암호를 아는 사람만 사용 |
| `ALLOWED_ORIGINS` | 변수 | 요청을 받을 게임 주소 (쉼표로 구분) |
| `GEMINI_MODEL` | 변수 | 쓸 모델 (기본 `gemini-2.5-flash`, AI Studio에서 지금 쓸 수 있는 이름으로 바꿀 수 있음) |
| `DAILY_LIMIT_PER_IP` | 변수 | 접속한 곳마다 하루 요청 수 (기본 40) |
| `DAILY_LIMIT_TOTAL` | 변수 | 서버 전체 하루 요청 수 (기본 600) |

다른 AI로 바꾸려면 `src/index.js`의 `callGemini` 함수만 바꾸면 됩니다. 게임 쪽은 그대로입니다.
