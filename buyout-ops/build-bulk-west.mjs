#!/usr/bin/env node
/**
 * Build + curl-verify koumuten_major_cities_bulk_west.csv (verified candidates only)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const outPath = path.join(seedsDir, "koumuten_major_cities_bulk_west.csv");
const HEADER = ["company", "url", "prefecture", "source"];

const PORTAL_HOSTS = [
  "suumo.jp",
  "homes.co.jp",
  "tateruya.jp",
  "iegatari.com",
  "okayama-housing.com",
  "okayamakurashi.jp",
  "realestate.news.mynavi.jp",
  "school.stephouse.jp",
  "hiroshima-ie.com",
  "auka.jp",
  "bucchake-housing.co.jp",
  "yume-wagaya.com",
  "kitakyushu-buildhouse.com",
  "thirteensales.com",
  "fukuchukyo.com",
  "v-hf.com",
  "plala.or.jp",
  "picolle.biz",
  "tamahome.jp",
  "ai-koumuten.co.jp",
  "heim-k.com",
  "r-plus-house.com",
];

function norm(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function isPortal(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return PORTAL_HOSTS.some((p) => h === p || h.endsWith("." + p));
  } catch {
    return true;
  }
}

const existing = new Set();
for (const f of fs.readdirSync(seedsDir)) {
  if (!f.endsWith(".csv")) continue;
  try {
    for (const r of parseCsv(fs.readFileSync(path.join(seedsDir, f), "utf8")).rows) {
      if (r.url) existing.add(norm(r.url));
    }
  } catch {
    /* skip */
  }
}

/** Verified or high-confidence Maps research candidates */
const CANDIDATES = [
  // 鳥取市
  ["寿ホームズ株式会社", "https://kotobukitochi.jp/", "鳥取市"],
  ["株式会社ひらぎの", "https://www.hiragino.com/", "鳥取市"],
  ["中央建設株式会社", "https://ckg.jp/", "鳥取市"],
  ["R+house鳥取", "https://rhousesanin.com/", "鳥取市"],
  ["アート建工", "https://www.art-kenko.com/", "鳥取市"],
  ["トコスホーム", "https://tocos-home.com/", "鳥取市"],
  ["有限会社山本工務店", "https://www.yamamoto-t.net/", "鳥取市"],
  ["有限会社井本工務店", "https://imotokoumuten.jp/", "鳥取市"],

  // 松江市
  ["林谷ホーム", "https://hayashitani.co.jp/", "松江市"],
  ["井原建設", "https://www.ibarchi0901.com/", "松江市"],
  ["梶野工務店", "https://www.kajinokoumuten.com/", "松江市"],
  ["ハウジング・スタッフ", "https://www.housing-staff.co.jp/", "松江市"],
  ["アート建工", "https://www.art-kenko.com/", "松江市"],
  ["トコスホーム", "https://tocos-home.com/", "松江市"],

  // 岡山市 (seirei 10-15)
  ["SPECIALABO", "https://specialabo.co.jp/", "岡山市"],
  ["株式会社SANKO", "https://www.sankohousing.co.jp/", "岡山市"],
  ["株式会社タカ建築", "http://www.takaken-okayama.com/", "岡山市"],
  ["株式会社ミナモト建築工房", "https://minamoto-k.com/", "岡山市"],
  ["エコハウス岡山株式会社", "https://www.ecohouse-okayama.jp/", "岡山市"],
  ["ヘルシーホーム", "https://www.healthy-home.co.jp/", "岡山市"],
  ["株式会社近藤建設興業", "https://www.kondo-kk.com/", "岡山市"],
  ["株式会社北屋建設", "http://www.tombo-kitaya.co.jp/", "岡山市"],
  ["株式会社タウンハウス", "http://www.1townhouse.com/", "岡山市"],
  ["株式会社コムハウジング", "http://www.comhousing.com/", "岡山市"],
  ["有限会社まきび住建", "http://www.makibi.co.jp/", "岡山市"],
  ["橋本興産株式会社", "http://www.hashimotokousan.co.jp/", "岡山市"],
  ["有限会社鞠子建設", "http://www.mariko.co.jp/", "岡山市"],
  ["株式会社武田工務店", "https://www.takeda-koumuten.com/", "岡山市"],
  ["カンパニーハウジング山忠", "https://www.wood-stage.com/", "岡山市"],
  ["designers house TOIRO", "https://dh-toiro.co.jp/", "岡山市"],
  ["株式会社武建", "https://www.takeken.co.jp/", "岡山市"],
  ["株式会社アイム・コラボレーション", "https://im-c.jp/", "岡山市"],
  ["株式会社コスミック", "https://www.cosmic-g.jp/", "岡山市"],
  ["株式会社武井工務店", "https://www.k-takei.co.jp/", "岡山市"],
  ["アトリエスマイル", "https://www.atelier-smile.jp/", "岡山市"],
  ["きまま218", "https://www.kimama218.jp/", "岡山市"],
  ["無添加住宅", "https://www.mutenka-house.jp/", "岡山市"],
  ["コラボハウス", "https://www.collabohouse.jp/", "岡山市"],

  // 広島市 (seirei 10-15)
  ["株式会社山根木材", "https://www.yamane-m.co.jp/", "広島市"],
  ["株式会社橋本建設", "https://www.hashimoto-k.co.jp/", "広島市"],
  ["株式会社マエダハウジング", "https://www.maeda-h.co.jp/", "広島市"],
  ["株式会社大喜", "https://daiki1970.co.jp/", "広島市"],
  ["321HOUSE", "https://321house.jp/", "広島市"],
  ["株式会社ゴジョウ", "https://gojyou.co.jp/", "広島市"],
  ["株式会社Cozy", "https://www.k-cozy.co.jp/", "広島市"],
  ["株式会社さくらホーム", "https://www.sakura-home.co.jp/", "広島市"],
  ["株式会社オールハウス", "https://www.allhouse.co.jp/", "広島市"],
  ["株式会社住研社", "https://www.jyuken.co.jp/", "広島市"],
  ["株式会社マリモハウス", "https://www.marimohouse.co.jp/", "広島市"],

  // 山口市
  ["株式会社永見工務店", "https://kinoie-nagami.co.jp/", "山口市"],
  ["いえとち本舗山口", "https://smarthouse-yamaguchi.jp/", "山口市"],
  ["third.gear.builders", "https://third-gear-builders.jp/", "山口市"],
  ["株式会社田村ビルズ", "http://www.tamura-kenzai.co.jp/", "山口市"],
  ["髙山産業株式会社", "https://takayama-ind.co.jp/", "山口市"],
  ["山口工務店", "https://www.yamaguchi-koumuten.jp/", "山口市"],

  // 徳島市
  ["株式会社徳島設計工房", "https://tsk-k.com/", "徳島市"],
  ["有限会社つくし工務店", "https://tsukushikoumuten.com/", "徳島市"],
  ["山田工務店", "https://www.shikinoie.co.jp/", "徳島市"],
  ["株式会社ナイスリフォーム", "http://www.nice-reform.jp/", "徳島市"],
  ["株式会社はなおか", "https://www.k-hanaoka-kagawa.com/", "徳島市"],

  // 高松市
  ["株式会社坂井工務店", "https://sakai-koumuten.jp/", "高松市"],
  ["sorai", "https://www.sorai.co.jp/", "高松市"],
  ["関元工務店", "https://sekimoto-koumuten.com/", "高松市"],
  ["島色工務店", "https://shimairo.com/", "高松市"],
  ["井坂工務店", "https://s-isaka.com/", "高松市"],
  ["株式会社 LIFE WORK", "https://lifework-architect.com/", "高松市"],
  ["株式会社意匠計画Horigami", "https://ishou-h.com/", "高松市"],
  ["株式会社ハウスエンジ", "https://www.houseengi.jp/", "高松市"],
  ["あまみホーム", "https://amamihome.net/", "高松市"],

  // 高知市
  ["株式会社建匠", "https://xn--mjrr9y.com/", "高知市"],
  ["株式会社はりまや住宅", "https://www.harimaya.co.jp/", "高知市"],
  ["有限会社タイセイホーム", "https://www.taisei-home.com/", "高知市"],
  ["家工房猪野工務店", "https://www.1-ino.co.jp/", "高知市"],
  ["土佐工務店", "https://www.tosa-koumuten.com/", "高知市"],

  // 福岡市 (seirei 10-15)
  ["清武建設", "https://www.kiyotake-fukuoka.com/", "福岡市"],
  ["REGALO建設設計", "https://regalo-design.jp/", "福岡市"],
  ["株式会社七呂建設", "https://www.shichiro.com/", "福岡市"],
  ["株式会社秀建", "https://www.shuken.co.jp/", "福岡市"],
  ["株式会社ナガタ建設", "https://www.nagata-kensetsu.co.jp/", "福岡市"],
  ["(株)タカノホーム", "http://www.takanohome.co.jp/", "福岡市"],
  ["(株)福岡工務店", "https://www.fukuoka-k.jp/", "福岡市"],
  ["健康住宅(株)", "http://www.kenkoh-jutaku.co.jp/", "福岡市"],
  ["エコワークス(株)", "http://www.eco-works.jp/", "福岡市"],
  ["(株)未来工房", "http://www.mirai-kohboh.co.jp/", "福岡市"],
  ["(株)雅建設", "http://www.miyabi-con.jp/", "福岡市"],
  ["(株)三宅建築工房", "http://miyake-koubou.com/", "福岡市"],
  ["(株)ベストホーム", "http://e-besthome.jp/", "福岡市"],
  ["(株)グリーン企画", "http://www.eco-cure.net/", "福岡市"],
  ["(株)穴井工務店", "http://www.anai.co.jp/", "福岡市"],
  ["(株)リバティーホーム", "http://libertygroup.jp/", "福岡市"],
  ["(株)アルシスホーム", "http://www.al-fine.jp/", "福岡市"],
  ["(株)駅前工務店", "http://www.ekimaekoumuten.co.jp/", "福岡市"],
  ["でんホーム(株)", "https://www.denhome.jp/", "福岡市"],
  ["(株)エースホーム", "https://acehome.net/", "福岡市"],
  ["(有)野村工務店", "https://www.nomura-komuten.com/", "福岡市"],
  ["(株)ミライズ", "https://mi-rise.biz/", "福岡市"],
  ["斎藤工務店", "https://www.saito-koumuten.com/", "福岡市"],
  ["建築プランナー(株)", "https://www.kpkp.co.jp/", "福岡市"],
  ["(株)広田工務店", "https://www.hirota-co.jp/", "福岡市"],
  ["(株)馬渡ホーム", "https://www.mawatari-home.jp/", "福岡市"],
  ["(株)梅野建設", "https://www.umeno.co.jp/", "福岡市"],
  ["(株)マツヨシ工務店", "https://www.matsuyoshi-komuten.co.jp/", "福岡市"],
  ["田辺木材ホーム", "https://www.tanabe-home.co.jp/", "福岡市"],
  ["コスモレーベン(株)", "https://kuturogi.jp/", "福岡市"],
  ["(株)清武建設", "https://www.kiyotake.co.jp/", "福岡市"],
  ["(株)e-house", "https://fukuoka-e-house.jp/", "福岡市"],
  ["(株)アーキテックス", "https://architex.co.jp/", "福岡市"],

  // 北九州市 (seirei 10-15)
  ["ハゼモト建設株式会社", "https://hazemoto-k.co.jp/", "北九州市"],
  ["CRATCH", "http://cratch.co.jp/", "北九州市"],
  ["株式会社今村工務店", "https://www.imamura-k.co.jp/", "北九州市"],
  ["株式会社サン建築工房", "https://www.sunken.co.jp/", "北九州市"],
  ["大楠建業", "http://okusu.jp/", "北九州市"],
  ["岩本工務店", "https://iwamotokomuten.com/", "北九州市"],
  ["高性能住宅KIZUKi", "https://www.kizuki1885.com/", "北九州市"],
  ["株式会社Ace", "https://ace-kitakyushu.com/", "北九州市"],
  ["株式会社吉田工務店", "https://ysd-k.jp/", "北九州市"],
  ["株式会社安岡工務店", "https://yoiie-yasuoka.co.jp/", "北九州市"],
  ["(株)山﨑建設", "http://yamasaki-1972.co.jp/", "北九州市"],
  ["(株)西江ハウジング", "http://nishie-housing.com/", "北九州市"],
  ["(株)ナカジマ建設", "https://n-techno.net/", "北九州市"],
  ["Rin建築", "https://rin-k.co.jp/", "北九州市"],
  ["(株)伊都住建", "http://itohouse.jp/", "北九州市"],
  ["(株)眞鍋建設", "http://www.manabe-k.com/", "北九州市"],

  // 佐賀市
  ["ディライツホーム株式会社", "https://www.delights-home.jp/", "佐賀市"],
  ["プレースホーム", "https://www.place-home.co.jp/", "佐賀市"],
  ["有限会社日楽ホーム", "https://nichiraku.co.jp/", "佐賀市"],
  ["エムハウス株式会社", "http://emhouse.jp/", "佐賀市"],
  ["くが工務店", "https://kugakoumuten.com/", "佐賀市"],
  ["株式会社遠江工務店", "https://toonoe-koumuten.jp/", "佐賀市"],

  // 長崎市
  ["匠工務店", "https://takumikoumuten.com/", "長崎市"],
  ["株式会社平石工務店", "https://woodmanhome.com/", "長崎市"],
  ["ヤベホーム", "https://yabehome.jp/", "長崎市"],
  ["株式会社嶋田工務店", "https://www.shimada-koumuten.net/", "長崎市"],
  ["株式会社長崎工務店", "https://www.nagasaki-koumuten.jp/", "長崎市"],
  ["株式会社長崎建設", "https://www.nagasaki-kensetsu.co.jp/", "長崎市"],

  // 熊本市 (seirei 10-15)
  ["新産住拓", "https://sumai.shinsan.com/", "熊本市"],
  ["株式会社三友工務店", "https://www.sanyu-k.jp/", "熊本市"],
  ["村田工務店", "https://k-murata.co.jp/", "熊本市"],
  ["morigu", "https://moriguchi-k.jp/", "熊本市"],
  ["幸保工務店", "https://www.yukiyasu.co.jp/", "熊本市"],
  ["立石工務店", "https://tateishi-con.co.jp/", "熊本市"],
  ["有限会社矢野工務店", "http://www.kamuri.co.jp/", "熊本市"],
  ["株式会社志水工務店", "https://www.shimizu-koumuten.jp/", "熊本市"],
  ["株式会社レゴリスアーキテクト", "https://www.regolith-architect.com/", "熊本市"],
  ["株式会社シアーズホーム", "https://searshome.co.jp/", "熊本市"],
  ["株式会社ジャストホーム", "https://www.justhome.co.jp/", "熊本市"],
  ["株式会社Lib Work", "https://www.libwork.co.jp/", "熊本市"],
  ["株式会社アーバンホーム", "https://www.urbanhome.co.jp/", "熊本市"],

  // 大分市
  ["府内町家", "https://funaimachiya.com/", "大分市"],
  ["わさだ工務店", "https://www.kino-sumai.com/", "大分市"],
  ["有限会社ベネッツ", "https://www.benet.co.jp/", "大分市"],
  ["株式会社神野工務店", "https://www.jinno-koumuten.com/", "大分市"],
  ["三越商事大分", "https://www.mitsukoshi-oita.co.jp/", "大分市"],
  ["SAKAIの家", "https://www.saladhome.com/", "大分市"],
  ["FDM株式会社", "https://www.fdm.co.jp/", "大分市"],
  ["イシンホーム", "https://www.ishinhome.com/", "大分市"],
  ["エイト", "https://www.8home.jp/", "大分市"],
  ["ベツダイホーム", "https://www.betsudai.com/", "大分市"],

  // 宮崎市
  ["正工務店", "https://tadashi-koumuten.com/", "宮崎市"],
  ["設計工房イズム", "https://www.ismhome.jp/", "宮崎市"],
  ["マルケンホーム", "https://smart-zerobox-maruken.com/", "宮崎市"],
  ["吉原建設", "https://yoshihara-kensetsu.com/", "宮崎市"],
  ["中武建設株式会社", "http://www.nakatake.co.jp/", "宮崎市"],
  ["株式会社宮崎建設", "https://www.miyazaki-kensetsu.co.jp/", "宮崎市"],

  // 鹿児島市
  ["株式会社相塲工務店", "https://aiba-koumuten.jp/", "鹿児島市"],
  ["増田工務店", "https://maruhey.jp/", "鹿児島市"],
  ["グリーンゲーブル", "https://k-greengable.com/", "鹿児島市"],
  ["株式会社Sin工房", "https://www.sinkoubou.jp/", "鹿児島市"],

  // 那覇市
  ["ミヤビホーム", "https://www.miyabi-home.net/", "那覇市"],
  ["株式会社井上工務店", "https://inoue-ca.com/", "那覇市"],
  ["株式会社カネヨシ工務店", "http://www.kaneyoshi-k.com/", "那覇市"],
  ["タイホウ建設", "https://taihou55.com/", "那覇市"],
  ["株式会社ホーム21", "https://home21.co.jp/", "那覇市"],
  ["大晋建設株式会社", "https://www.shinyo21.co.jp/", "那覇市"],
  ["株式会社東商", "https://www.kk-tosho.co.jp/", "那覇市"],
  ["金城組", "https://kinjogumi.co.jp/", "那覇市"],
  ["Studio Citta", "https://studio-citta.okinawa/", "那覇市"],
  ["サイアスホーム", "https://www.saias-home.co.jp/", "那覇市"],
  ["株式会社ゆめハウス", "https://www.yume-h.com/", "那覇市"],
  ["福智組", "https://www.fukuchigumi.co.jp/", "那覇市"],
  ["未来ホーム", "https://mirai-home.net/", "那覇市"],
  ["株式会社imhome", "https://www.imhome-okinawa.co.jp/", "那覇市"],
  ["イーフレス", "https://www.e-flese.co.jp/", "那覇市"],
  ["沖縄木造住宅", "https://okinawamokuzou.com/", "那覇市"],
  ["STYLE HOPE", "https://stylehope.jp/", "那覇市"],
  ["あすなろ建設", "https://www.asunaro-rhouse.co.jp/", "那覇市"],
  ["エクラホーム", "https://www.eclathome.jp/", "那覇市"],
  ["Plus HOUSE", "https://www.plus-house.jp/", "那覇市"],
];

async function verifyUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "calcite-seed-verify/1.0" },
    });
    if ([405, 403, 501].includes(res.status)) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "calcite-seed-verify/1.0" },
      });
    }
    return res.status >= 200 && res.status < 400;
  } catch {
    if (url.startsWith("https://")) {
      try {
        const res = await fetch(url.replace(/^https:\/\//, "http://"), {
          method: "HEAD",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "User-Agent": "calcite-seed-verify/1.0" },
        });
        return res.status >= 200 && res.status < 400;
      } catch {
        return false;
      }
    }
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const outRows = [];
  const seen = new Set();
  const stats = { ok: 0, fail: 0, portal: 0, dupeSeed: 0, dupeFile: 0 };

  for (const [company, url, prefecture] of CANDIDATES) {
    const nu = norm(url);
    if (seen.has(nu)) {
      stats.dupeFile++;
      continue;
    }
    if (isPortal(url)) {
      stats.portal++;
      continue;
    }
    process.stderr.write(`verify ${prefecture} ${url} ... `);
    const ok = await verifyUrl(url);
    if (!ok) {
      stats.fail++;
      process.stderr.write("FAIL\n");
      continue;
    }
    stats.ok++;
    process.stderr.write("OK\n");
    seen.add(nu);
    outRows.push({ company, url, prefecture, source: "maps_research" });
  }

  fs.writeFileSync(outPath, serializeCsv(HEADER, outRows) + "\n");

  const perCity = {};
  for (const r of outRows) perCity[r.prefecture] = (perCity[r.prefecture] || 0) + 1;

  console.log(JSON.stringify({ stats, perCity, total: outRows.length }, null, 2));
}

main();
