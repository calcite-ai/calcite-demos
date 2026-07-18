import activitiesData from '../data/activities.json';

export type Activity = {
  date: string;
  place: string;
  host: string;
  theme: string;
  audience: string;
  count: string;
};

export const activities = activitiesData as Activity[];

export function activityYear(a: Activity): string {
  return a.date.slice(0, 4);
}

/** 直近N年分（暦年） */
export function recentActivities(years = 2): Activity[] {
  const current = new Date().getFullYear();
  const from = current - (years - 1);
  return activities.filter((a) => {
    const y = Number(activityYear(a));
    return y >= from && y <= current;
  });
}

export function activitiesByYear(): { year: string; items: Activity[] }[] {
  const map = new Map<string, Activity[]>();
  for (const a of activities) {
    const y = activityYear(a);
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(a);
  }
  return [...map.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, items]) => ({ year, items }));
}

export function activitySummary() {
  const years = activitiesByYear().map((y) => y.year);
  const prefs = new Map<string, number>();
  for (const a of activities) {
    const m = a.place.match(
      /(東京都|神奈川県|埼玉県|千葉県|静岡県|茨城県|岐阜県|長崎県|新潟県|大阪府|京都府|兵庫県|三重県|愛知県|山梨県)/,
    );
    let pref = m?.[1];
    if (!pref) {
      if (
        /区$|都内|板橋|練馬|大田|新宿|品川|江戸川|江東|三鷹|港区|渋谷|豊島|北区|杉並|世田谷|足立|葛飾|中野|目黒|台東|墨田|文京|中央区|千代田|荒川|立川|八王子|町田|青梅|武蔵野|高島平|荏原|蘇我/.test(
          a.place,
        )
      ) {
        pref = '東京都';
      }
    }
    if (pref) prefs.set(pref, (prefs.get(pref) ?? 0) + 1);
  }
  const regions = [...prefs.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return {
    total: activities.length,
    yearFrom: years[years.length - 1],
    yearTo: years[0],
    yearCount: years.length,
    regions,
    regionNames: regions.map((r) => r.name),
  };
}
