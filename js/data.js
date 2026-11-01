// JSON 데이터를 한 번만 불러와 재사용한다.
const cache = new Map();

export async function loadJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((res) => {
      if (!res.ok) throw new Error(`${path}을(를) 불러오지 못했습니다 (${res.status})`);
      return res.json();
    }));
  }
  return cache.get(path);
}

export const FLOOR_LABEL = { B1: '지하', '1F': '1층', '2F': '2층', '3F': '3층', '4F': '4층', '5F': '5층' };

export const KIND_LABEL = {
  dorm_room: '기숙사 호실',
  corridor: '복도',
  stair: '계단',
  entrance: '입구',
  warden: '사감실',
  facility: '생활 시설',
  lounge: '휴게실',
  hidden: '???',
};
