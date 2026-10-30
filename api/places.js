// Vercel 서버리스 함수: 제주 역사문화 장소 API
//
// 공공데이터포털(data.go.kr) 오픈API 2개를 서버에서 호출해 고유번호로 합친 뒤 JSON 으로 돌려줘요.
//   · 제주특별자치도_제주역사문화위치정보 (15109570)  → 장소명, 위도, 경도, 주소 ...
//   · 제주특별자치도_제주역사문화일반정보 (15109587)  → 분류, 제목, 내용, 저작자 ...
// 인증키(DATA_GO_KR_KEY)는 코드에 없고 Vercel 환경변수에만 있어요. 브라우저에는 절대 내려가지 않아요.
//
//   GET /api/places                          → 전체 { count, total, items }
//   GET /api/places?q=해녀                    → 장소명·제목·주소·내용 등에서 검색
//   GET /api/places?category=민속&region=제주시 → 분류·지역으로 거르기
//   GET /api/places?id=367                   → 장소 1곳 (없으면 404)

const BASE = 'https://api.odcloud.kr/api';
const LOCATION = `${BASE}/15109570/v1/uddi:8781448b-81a8-487c-bc95-d26335bafa82`;
const GENERAL = `${BASE}/15109587/v1/uddi:56c2b3a4-4b4b-46cd-a1fa-f928ef731ffb`;

const PER_PAGE = 200;
const MEMORY_TTL_MS = 60 * 60 * 1000; // 같은 서버 인스턴스에서는 1시간 동안 다시 부르지 않아요

let memory = null; // { at, items }

// 포털에서 복사한 "인코딩 키"(%가 들어 있음)든 "디코딩 키"든 한 번만 인코딩되게 맞춰요.
function readKey() {
  const raw = (process.env.DATA_GO_KR_KEY || '').trim();
  return raw.includes('%') ? decodeURIComponent(raw) : raw;
}

class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

// odcloud 한 개를 끝까지(페이지 넘겨 가며) 가져와요. 에러 메시지에는 URL(=키)을 넣지 않아요.
async function fetchAll(endpoint, key, label) {
  const rows = [];
  let page = 1;
  let total = Infinity;
  while (rows.length < total) {
    const url = `${endpoint}?${new URLSearchParams({ page: String(page), perPage: String(PER_PAGE), returnType: 'JSON', serviceKey: key })}`;
    let res;
    try {
      res = await fetch(url);
    } catch {
      throw new ApiError(`${label}: 공공데이터포털에 연결하지 못했어요.`);
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(`${label}: 응답을 읽지 못했어요. (HTTP ${res.status})`);
    }
    if (!res.ok || json.code) {
      const msg = json.msg || json.message || `HTTP ${res.status}`;
      const hint = /등록되지|인증키|key/i.test(msg)
        ? ' (공공데이터포털에서 이 데이터의 활용신청이 승인됐는지, 환경변수 DATA_GO_KR_KEY 가 맞는지 확인하세요)'
        : '';
      throw new ApiError(`${label}: ${msg}${hint}`);
    }
    const data = Array.isArray(json.data) ? json.data : [];
    rows.push(...data);
    total = Number(json.totalCount) || rows.length;
    if (data.length === 0) break;
    page += 1;
  }
  return rows;
}

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '해당없음' ? '' : s;
};

// 두 데이터를 고유번호로 합치고, 화면이 쓰는 영어 키로 바꿔요.
function merge(locations, generals) {
  const gmap = new Map(generals.map((g) => [String(g['데이터 고유번호']), g]));
  return locations.map((l) => {
    const id = String(l['데이터 고유번호']);
    const g = gmap.get(id) || {};
    return {
      id: Number(id),
      name: clean(l['장소명']),
      lat: Number(l['위도']),
      lon: Number(l['경도']),
      zip: clean(l['우편번호']),
      address: clean(l['위치']).replace(/^제주특별자치도\s*/, ''),
      url: clean(l['데이터 상세보기 URL']),
      category: clean(g['분류']),
      dir1: clean(g['디렉토리1']),
      dir2: clean(g['디렉토리2']),
      title: clean(g['제목']),
      subtitle: clean(g['부제목']),
      author: clean(g['저작자']),
      subject: clean(g['주제']),
      content: clean(g['내용']),
      toc: clean(g['목차']),
      abstract: clean(g['초록']),
      publisher: clean(g['발행자']),
      date: clean(g['발행일']),
      type: clean(g['자료유형']),
      form: clean(g['자료형태']),
      source: clean(g['출처']),
    };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

async function loadPlaces() {
  if (memory && Date.now() - memory.at < MEMORY_TTL_MS) return memory.items;
  const key = readKey();
  if (!key) throw new ApiError('서버에 DATA_GO_KR_KEY 환경변수가 없어요. Vercel > Settings > Environment Variables 에 넣어 주세요.', 500);
  const [locations, generals] = await Promise.all([
    fetchAll(LOCATION, key, '위치정보 API'),
    fetchAll(GENERAL, key, '일반정보 API'),
  ]);
  const items = merge(locations, generals);
  memory = { at: Date.now(), items };
  return items;
}

const haystack = (d) =>
  [d.name, d.title, d.subtitle, d.subject, d.address, d.dir1, d.dir2, d.content].join(' ').toLowerCase();

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원해요.' });
  }

  let places;
  try {
    places = await loadPlaces();
  } catch (e) {
    // 실패한 응답은 캐시하지 않아요.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(e.status || 502).json({ error: e.message });
  }

  // 정적 자료라서 성공 응답은 하루 동안 CDN에 캐시해 API 호출 횟수를 아껴요.
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  const { q = '', category = '', region = '', id = '' } = req.query || {};

  if (id) {
    const one = places.find((d) => String(d.id) === String(id));
    if (!one) return res.status(404).json({ error: '해당 장소가 없어요.' });
    return res.status(200).json(one);
  }

  let items = places;
  if (category) items = items.filter((d) => d.category === category);
  if (region) items = items.filter((d) => d.address.split(' ')[0] === region);
  const needle = String(q).trim().toLowerCase();
  if (needle) items = items.filter((d) => haystack(d).includes(needle));

  return res.status(200).json({ count: items.length, total: places.length, items });
};
