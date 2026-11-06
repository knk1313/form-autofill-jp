// ページに差し込み、フォームの欄を見分けてプロフィールを入れるスクリプト。
// background.js が executeScript で読み込み、globalThis.__formAutofillJp.fill(profile) を呼ぶ。
(() => {
  if (globalThis.__formAutofillJp) return;

  // ---- 文字の変換 ----------------------------------------------------------

  const JA_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
  const HALF_KANA_RE = /[ｦ-ﾟ]/;

  // カタカナ → ひらがな
  const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // ひらがな → カタカナ
  const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

  // 全角カタカナ → 半角カタカナ。濁点・半濁点は NFD で分けてから置き換える
  const FULL_KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー゙゚　';
  const HALF_KANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｰﾞﾟ ';
  const toHalfKana = (s) =>
    [...toKatakana(s).normalize('NFD')].map((c) => {
      const i = FULL_KANA.indexOf(c);
      return i >= 0 ? HALF_KANA[i] : c;
    }).join('');

  // 判定用に、全角英数を半角に、半角カナを全角にそろえて小文字にする
  const norm = (s) => (s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

  // ---- 都道府県と和暦 ------------------------------------------------------

  const PREFS = [
    ['北海道', 'Hokkaido'], ['青森県', 'Aomori'], ['岩手県', 'Iwate'], ['宮城県', 'Miyagi'], ['秋田県', 'Akita'],
    ['山形県', 'Yamagata'], ['福島県', 'Fukushima'], ['茨城県', 'Ibaraki'], ['栃木県', 'Tochigi'], ['群馬県', 'Gunma'],
    ['埼玉県', 'Saitama'], ['千葉県', 'Chiba'], ['東京都', 'Tokyo'], ['神奈川県', 'Kanagawa'], ['新潟県', 'Niigata'],
    ['富山県', 'Toyama'], ['石川県', 'Ishikawa'], ['福井県', 'Fukui'], ['山梨県', 'Yamanashi'], ['長野県', 'Nagano'],
    ['岐阜県', 'Gifu'], ['静岡県', 'Shizuoka'], ['愛知県', 'Aichi'], ['三重県', 'Mie'], ['滋賀県', 'Shiga'],
    ['京都府', 'Kyoto'], ['大阪府', 'Osaka'], ['兵庫県', 'Hyogo'], ['奈良県', 'Nara'], ['和歌山県', 'Wakayama'],
    ['鳥取県', 'Tottori'], ['島根県', 'Shimane'], ['岡山県', 'Okayama'], ['広島県', 'Hiroshima'], ['山口県', 'Yamaguchi'],
    ['徳島県', 'Tokushima'], ['香川県', 'Kagawa'], ['愛媛県', 'Ehime'], ['高知県', 'Kochi'], ['福岡県', 'Fukuoka'],
    ['佐賀県', 'Saga'], ['長崎県', 'Nagasaki'], ['熊本県', 'Kumamoto'], ['大分県', 'Oita'], ['宮崎県', 'Miyazaki'],
    ['鹿児島県', 'Kagoshima'], ['沖縄県', 'Okinawa'],
  ];

  const ERAS = [
    { ja: '令和', short: 'r', en: 'reiwa', start: [2019, 5, 1] },
    { ja: '平成', short: 'h', en: 'heisei', start: [1989, 1, 8] },
    { ja: '昭和', short: 's', en: 'showa', start: [1926, 12, 25] },
    { ja: '大正', short: 't', en: 'taisho', start: [1912, 7, 30] },
  ];

  function toWareki(y, m, d) {
    const n = y * 10000 + m * 100 + d;
    for (const e of ERAS) {
      const [sy, sm, sd] = e.start;
      if (n >= sy * 10000 + sm * 100 + sd) return { era: e, year: y - sy + 1 };
    }
    return null;
  }

  // ---- 欄のまわりの文字を集める ---------------------------------------------

  const textOf = (node) => {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll?.('input,select,textarea,option,script,style').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  function labelText(el) {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(textOf(l));
    const ids = el.getAttribute('aria-labelledby');
    if (ids) for (const id of ids.split(/\s+/)) parts.push(textOf(document.getElementById(id)));
    return parts.join(' ');
  }

  // 直前に並んだ短い文字（「姓 [ ] 名 [ ]」のような並び）
  function prevText(el) {
    let s = '';
    for (let n = el.previousSibling; n; n = n.previousSibling) {
      // 別の欄を含む要素の手前までで止める（前の欄のラベルを拾わないように）
      if (n.nodeType === 1 && (n.matches('input,select,textarea,br,div,p,tr,td,th,li,dd,dt') || n.querySelector('input,select,textarea'))) break;
      s = (n.textContent || '') + s;
      if (s.length > 30 || (n.nodeType === 1 && n.tagName === 'LABEL')) break;
    }
    s = s.replace(/\s+/g, ' ').trim();
    return s.length <= 20 ? s : '';
  }

  // 直後に並んだ短い文字（「[ ] 年 [ ] 月」のような並び）
  function nextText(el) {
    let s = '';
    for (let n = el.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === 1 && n.matches('input,select,textarea,br,div,p')) break;
      s += n.textContent || '';
      if (s.trim()) break;
    }
    return s.trim().slice(0, 4);
  }

  // 行の見出し（表の th、定義リストの dt、近い祖先の文字）
  function rowContext(el) {
    const td = el.closest('td');
    if (td) {
      const tr = td.closest('tr');
      const th = tr?.querySelector('th');
      if (th) return textOf(th);
      const first = tr?.querySelector('td');
      if (first && first !== td) return textOf(first);
    }
    const dd = el.closest('dd');
    if (dd) {
      let p = dd.previousElementSibling;
      while (p && p.tagName !== 'DT') p = p.previousElementSibling;
      if (p) return textOf(p);
    }
    const fs = el.closest('fieldset');
    const legend = fs?.querySelector('legend');
    let node = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      if (node === fs && legend) return textOf(legend);
      if (node.querySelectorAll('input:not([type=hidden]),select,textarea').length > 4) break;
      const t = textOf(node);
      if (t && t.length <= 80) return t;
    }
    return legend ? textOf(legend) : '';
  }

  // ---- 欄の種類を見分ける ----------------------------------------------------

  // 上から順に試し、最初に当たった種類にする。先に置くほど優先される
  const RULES = [
    ['skip', /fax|ファックス|ファクス|captcha|認証コード|確認コード|パスワード|password|検索|search|クーポン|coupon|カード番号|card.?number|セキュリティ|件名|題名|subject|ユーザー?名|user.?name|login|ログイン|ニックネーム|nickname|アカウント|表示名|display.?name|(商品|ファイル|店舗?|学校|大学|サービス|プロジェクト|製品|イベント|ブランド|サイト)名/],
    ['email', /e-?mail|メール|メアド|(^|[^a-z])mail(?!ing)/],
    ['postal', /郵便番号|〒|postal|zip|post.?code|yubin|郵便/],
    ['tel', /電話|携帯|phone|mobile|(^|[^a-z])tel|連絡先番号/],
    ['prefecture', /都道府県|prefecture|(^|[^a-z])pref(?![a-z])|province|(^|[^a-z])state(?![a-z])|address-level1|(^|[^a-z])region/],
    ['city', /市区町村|市町村|区市町村|市区郡|(^|[^a-z])city|(^|[^a-z])town|locality|address-level2/],
    ['building', /建物|マンション|ビル名|部屋番号|号室|アパート|building|(^|[^a-z])bldg?([^a-z]|$)|apartment|(^|[^a-z])apt|suite|(^|[^a-z])room|address-line2/],
    ['street', /番地|丁目|町名|町域|street|address-line1/],
    ['country', /国名|国・地域|国\/地域|country/],
    ['address', /住所|所在地|address|(^|[^a-z])addr/],
    ['birthday', /生年月日|誕生日|birth|bday|(^|[^a-z])dob(?![a-z])/],
    ['gender', /性別|gender|(^|[^a-z])sex(?![a-z])/],
    ['company', /会社|企業|法人|団体名|組織|勤務先|貴社|御社|company|organi[sz]ation|(^|[^a-z])corp/],
    ['department', /部署|所属|部門|department|division/],
    ['name', /氏名|名前|姓|名|苗字|名字|フリガナ|ふりがな|カナ|(^|[^a-z])(kana|furigana)|name|(^|[^a-z])(sei|mei)([^a-z]|$)/],
  ];

  const AUTOCOMPLETE = {
    'family-name': ['name', 'last'], 'given-name': ['name', 'first'], name: ['name', 'full'],
    email: ['email'], tel: ['tel'], 'tel-national': ['tel'], 'postal-code': ['postal'],
    'address-level1': ['prefecture'], 'address-level2': ['city'], 'address-line1': ['street'],
    'address-line2': ['building'], 'street-address': ['address'], country: ['country'], 'country-name': ['country'],
    bday: ['birthday'], 'bday-year': ['birthday', 'year'], 'bday-month': ['birthday', 'month'], 'bday-day': ['birthday', 'day'],
    sex: ['gender'], organization: ['company'],
  };

  const LAST_RE = /姓(?!名)|苗字|名字|^せい$|^セイ$|last|family|surname|(^|[^a-z])l_?name|(^|[^a-z])sei([^a-z]|$)/;
  const FIRST_RE = /(^|[^氏姓会社署])名(?![前字称])|^めい$|^メイ$|first|given|forename|(^|[^a-z])f_?name|(^|[^a-z])mei([^a-z]|$)/;
  const KANA_RE = /フリガナ|ふりがな|よみがな|カナ|かな|(^|[^a-z])(kana|furigana|yomi|ruby)|読み/;
  const ROMAJI_RE = /ローマ字|romaji|roman|英字|アルファベット|alphabet|英語|english|(^|[_\-\s])(en|eng)($|[_\-\s])/;
  const NO_HYPHEN_RE = /ハイフン(なし|無し|不要|を?除|は?入れない|抜き)|-なし|without.?(hyphen|dash)|no.?(hyphen|dash)|digits.?only|数字のみ/;

  function classify(t) {
    if (!t) return null;
    for (const [kind, re] of RULES) if (re.test(t)) return kind;
    return null;
  }

  // 1つの文字列の中で、姓と名のどちらを指しているか（両方なら決めない）
  function namePart(t) {
    const last = LAST_RE.test(t);
    const first = FIRST_RE.test(t);
    if (last && !first) return 'last';
    if (first && !last) return 'first';
    return null;
  }

  // 例として書かれた値だけを取り出す（「例：山田」→「山田」）
  const sample = (ph) => (ph || '').replace(/^\s*(例|例え?ば|e\.?g\.?|ex\.?)\s*[:：)）.]?\s*/i, '').trim();

  const isEra = (sel) => [...sel.options].some((o) => /令和|平成|昭和/.test(o.text));

  function selectNums(sel) {
    return [...sel.options]
      .map((o) => parseInt(norm(o.text).replace(/元/, '1').match(/\d+/)?.[0] ?? norm(o.value).match(/\d+/)?.[0], 10))
      .filter((n) => !Number.isNaN(n));
  }

  // 生年月日の欄が、年・月・日のどれか
  function datePart(el) {
    if (el.tagName === 'SELECT') {
      if (isEra(el)) return 'era';
      const nums = selectNums(el);
      if (!nums.length) return null;
      const max = Math.max(...nums);
      if (max > 1800) return 'year';
      if (max > 31) return 'eraYear';
      if (max === 12 && nums.length <= 13) return 'month';
      if (max >= 28) return 'day';
      return null;
    }
    const nt = norm(nextText(el));
    if (/^年|^year/.test(nt)) return 'year';
    if (/^月|^month/.test(nt)) return 'month';
    if (/^日|^day/.test(nt)) return 'day';
    const t = norm([el.placeholder, el.getAttribute('aria-label'), el.name, el.id].join(' '));
    // 「MM/DD/YYYY」「1990/01/01」のように日付全体の例があれば、1つの欄に全部入れる
    if (/(yyyy|\d{4})\W*(mm?|\d{1,2})\W*(dd?|\d{1,2})|(mm?|\d{1,2})\W(dd?|\d{1,2})\W(yyyy|\d{4})/.test(norm(el.placeholder))) return null;
    if (/year|yyyy|(^|[^a-z])y([^a-z]|$)|^年$/.test(t)) return 'year';
    if (/month|(^|[^a-z])mm?([^a-z]|$)|^月$/.test(t)) return 'month';
    if (/(^|[^a-z])(day|dd?)([^a-z]|$)|^日$/.test(t)) return 'day';
    return null;
  }

  const SKIP_TYPES = new Set(['hidden', 'password', 'checkbox', 'file', 'submit', 'button', 'image', 'reset', 'range', 'color', 'search', 'url']);

  function eligible(el) {
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === 'INPUT' && SKIP_TYPES.has(el.type)) return false;
    // ラジオは見た目を差し替えて隠していることが多いので、表示の確認をしない
    if (el.type === 'radio') return true;
    if (el.closest('[hidden],[aria-hidden=true]')) return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) return false;
    return true;
  }

  function isEmpty(el) {
    if (el.tagName === 'SELECT') {
      const o = el.options[el.selectedIndex];
      return !o || !o.value || /選択|選んで|select|choose|^[-ー―]+$/i.test(o.text.trim());
    }
    return !el.value;
  }

  function analyze(el, pageMode) {
    const near = [el.placeholder, el.getAttribute('aria-label'), el.title, labelText(el), prevText(el)].filter(Boolean).join(' ');
    const attrs = [el.name, el.id].filter(Boolean).join(' ').replace(/([a-z])([A-Z])/g, '$1_$2');
    const ctx = rowContext(el);
    const sources = [norm(near), norm(attrs), norm(ctx)];
    const all = sources.join(' ');
    const rawAll = [near, attrs, ctx].join(' ');

    let kind = null;
    let part = null;
    const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase().split(/\s+/).pop();
    // autocomplete があればそれを正とし、なければ 近い文字 → name/id → 行の見出し の順に見る
    if (AUTOCOMPLETE[ac]) [kind, part = null] = AUTOCOMPLETE[ac];
    if (!kind) {
      const found = sources.map(classify);
      kind = found.find(Boolean) || null;
      // 「住所」「名前」のような広い種類は、ほかの手がかりがもっと細かい種類を示していればそちらにする
      // （name="addr_bld" と見出し「建物名」なら、建物の欄）
      const WIDE = { address: ['prefecture', 'city', 'street', 'building', 'postal'], name: [] };
      const finer = WIDE[kind] && found.find((k) => WIDE[kind].includes(k));
      if (finer) kind = finer;
    }
    if (!kind && el.type === 'email') kind = 'email';
    if (!kind && el.type === 'tel') kind = 'tel';
    if (!kind && el.tagName === 'SELECT' && isEra(el)) kind = 'birthday';
    // 例の値から見分ける（「例：taro@example.com」「例：090-1234-5678」）
    const ex = sample(el.placeholder);
    if (!kind && /@/.test(ex)) kind = 'email';
    if (!kind && /^\d{3}-?\d{4}$/.test(ex)) kind = 'postal';
    if (!kind && /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/.test(ex)) kind = 'tel';
    if (!kind || kind === 'skip') return null;
    if (el.type === 'radio' && kind !== 'gender') return null;

    const info = { el, kind, part, ctx: norm(ctx), wasEmpty: isEmpty(el) };

    // 日本語の欄か英語の欄か
    const human = near + ' ' + ctx;
    if (ROMAJI_RE.test(norm(all))) info.mode = 'en';
    else if (JA_RE.test(human)) info.mode = 'ja';
    else if (/[a-z]/i.test(human)) info.mode = 'en';
    else info.mode = pageMode;

    if (kind === 'name') {
      // 例が仮名だけなら、読みの欄とみなす
      const exKana = ex && /^[ぁ-ゖァ-ーｦ-ﾟ\s　]+$/.test(ex);
      if (KANA_RE.test(all) || exKana) {
        info.kana = HALF_KANA_RE.test(rawAll) || /半角カナ|半角カタカナ/.test(rawAll) || (exKana && HALF_KANA_RE.test(ex))
          ? 'half'
          : (/ふりがな|ひらがな|よみがな|(^|[^カ])かな/.test(rawAll) && !/カナ|カタカナ/.test(rawAll)) || (exKana && /[ぁ-ゖ]/.test(ex))
            ? 'hira'
            : 'kata';
        info.mode = 'ja';
      }
      if (!info.part) {
        for (const s of sources) {
          const p = namePart(s);
          if (p) { info.part = p; break; }
          if (LAST_RE.test(s) && FIRST_RE.test(s)) break;
        }
      }
      // 姓名を両方含む、または手がかりがない欄は、1つの欄に姓名を入れる（並びは後でまとめて決める）
      info.part ||= 'full';
      if (ex && /\s|　/.test(ex)) info.sep = /　/.test(ex) ? '　' : ' ';
      else if (ex && JA_RE.test(ex)) info.sep = '';
    }

    if (kind === 'birthday') info.part ||= el.type === 'date' ? 'iso' : datePart(el);
    if (kind === 'tel' || kind === 'postal') info.noHyphen = NO_HYPHEN_RE.test(all) || (/^\d{7,11}$/.test(ex)) || el.type === 'number';

    // 「住所1」「住所2」「住所3」のような番号つきの欄
    const num = all.match(/(住所|address|addr)[\s_\-\[]*([1-3])/);
    if (num && ['address', 'street', 'building'].includes(kind)) info.addrNum = Number(num[2]);
    return info;
  }

  // ラジオのまとまり（name ごと）を1つの欄として扱う
  function radioGroups(els) {
    const groups = new Map();
    for (const el of els) {
      if (el.type !== 'radio' || !el.name) continue;
      if (!groups.has(el.name)) groups.set(el.name, []);
      groups.get(el.name).push(el);
    }
    const infos = [];
    for (const radios of groups.values()) {
      const labels = radios.map((r) => norm(labelText(r) || r.value));
      const isGender = labels.some((l) => /女|female|woman/.test(l)) && labels.some((l) => /(^|[^女])男|(^|[^e])male|(^|[^wo])man/.test(l));
      if (isGender) infos.push({ el: radios[0], radios, labels, kind: 'gender', wasEmpty: !radios.some((r) => r.checked) });
    }
    return infos;
  }

  // ---- 分かれた欄をまとめる ----------------------------------------------------

  const PARTS = {
    name: (n, mode) => (n === 2 ? (mode === 'en' ? ['first', 'last'] : ['last', 'first']) : null),
    tel: (n) => (n === 3 ? [0, 1, 2] : n === 2 ? [0, 'rest'] : null),
    postal: (n) => (n === 2 ? [0, 1] : null),
    birthday: (n, mode) => (n === 3 ? (mode === 'en' ? ['month', 'day', 'year'] : ['year', 'month', 'day']) : null),
  };

  function resolveGroups(infos) {
    // 連続していて、種類と行の見出しが同じ欄を1つのまとまりとする
    let i = 0;
    while (i < infos.length) {
      const a = infos[i];
      const splittable = (x) =>
        (x.kind === 'name' && x.part === 'full') || ((x.kind === 'tel' || x.kind === 'postal') && x.part == null) || (x.kind === 'birthday' && !x.part);
      if (!splittable(a)) { i++; continue; }
      let j = i + 1;
      while (j < infos.length && infos[j].kind === a.kind && infos[j].ctx === a.ctx && (infos[j].kana || null) === (a.kana || null) && splittable(infos[j])) j++;
      const group = infos.slice(i, j);
      const parts = PARTS[a.kind]?.(group.length, a.mode);
      if (parts) group.forEach((x, k) => { x.part = parts[k]; });
      i = j;
    }

    // 番号つきの住所欄：3つあれば 市区町村・番地・建物、2つなら 番地・建物
    const numbered = infos.filter((x) => x.addrNum);
    if (numbered.length >= 2) {
      const three = numbered.some((x) => x.addrNum === 3);
      for (const x of numbered) x.kind = three ? ['city', 'street', 'building'][x.addrNum - 1] : ['street', 'building'][x.addrNum - 1] || x.kind;
    }

    // 住所の組み立てに使うため、同じフォームに都道府県・市区町村・建物の欄があるかを調べる
    const kindsByForm = new Map();
    for (const x of infos) {
      const f = x.el.form || document;
      if (!kindsByForm.has(f)) kindsByForm.set(f, new Set());
      kindsByForm.get(f).add(x.kind);
    }
    for (const x of infos) {
      const kinds = kindsByForm.get(x.el.form || document);
      x.flags = { prefecture: kinds.has('prefecture'), city: kinds.has('city'), building: kinds.has('building') };
    }
  }

  // ---- 入れる値を決める --------------------------------------------------------

  function splitTel(tel) {
    const parts = tel.split(/[-‐ー−\s()]+/).filter(Boolean);
    if (parts.length >= 3) return parts.slice(-3);
    const d = tel.replace(/\D/g, '');
    if (d.length === 11) return [d.slice(0, 3), d.slice(3, 7), d.slice(7)];
    if (/^0[36]/.test(d)) return [d.slice(0, 2), d.slice(2, 6), d.slice(6)];
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6)];
  }

  function formatDate(info, b) {
    const ph = norm(info.el.placeholder);
    const p2 = (n) => String(n).padStart(2, '0');
    const max = info.el.maxLength > 0 ? info.el.maxLength : 0;
    if (/^(mm|\d{2})[\/-](dd|\d{2})[\/-](yyyy|\d{4})/.test(ph)) return `${p2(b.m)}/${p2(b.d)}/${b.y}`;
    if (/^(yyyymmdd|\d{8})$/.test(ph) || max === 8) return `${b.y}${p2(b.m)}${p2(b.d)}`;
    if (/年/.test(ph)) return `${b.y}年${b.m}月${b.d}日`;
    const sep = ph.match(/^(?:yyyy|\d{4})([\/.-])/)?.[1];
    if (sep) return [b.y, p2(b.m), p2(b.d)].join(sep);
    return info.mode === 'en' ? `${b.y}-${p2(b.m)}-${p2(b.d)}` : `${b.y}/${p2(b.m)}/${p2(b.d)}`;
  }

  function derive(p) {
    const pref = PREFS.find(([ja]) => ja === p.prefecture);
    const [y, m, d] = (p.birthday || '').split('-').map(Number);
    return {
      ...p,
      prefectureEn: pref?.[1] || '',
      birth: y ? { y, m, d, wareki: toWareki(y, m, d) } : null,
    };
  }

  // 値を決める。select に向けては候補の配列を返す
  function valueFor(info, v) {
    const en = info.mode === 'en';
    const flags = info.flags || {};
    const strip = (s) => (info.noHyphen ? s.replace(/\D/g, '') : s);
    switch (info.kind) {
      case 'name': {
        if (info.kana) {
          const conv = info.kana === 'hira' ? toHiragana : info.kana === 'half' ? toHalfKana : toKatakana;
          const sep = info.sep ?? (info.kana === 'half' ? ' ' : '　');
          const val = { last: v.lastKana, first: v.firstKana, full: v.lastKana && v.firstKana ? v.lastKana + '　' + v.firstKana : '' }[info.part];
          return val ? conv(val.replace('　', sep)) : '';
        }
        if (en) return { last: v.lastEn, first: v.firstEn, full: [v.firstEn, v.lastEn].filter(Boolean).join(' ') }[info.part];
        const sep = info.sep ?? '　';
        return { last: v.lastName, first: v.firstName, full: [v.lastName, v.firstName].filter(Boolean).join(sep) }[info.part];
      }
      case 'email': return v.email;
      case 'tel': {
        if (!v.tel) return '';
        if (info.part === 'rest') return splitTel(v.tel).slice(1).join(info.noHyphen ? '' : '-');
        if (typeof info.part === 'number') return splitTel(v.tel)[info.part];
        const val = strip(v.tel);
        return info.el.maxLength > 0 && val.length > info.el.maxLength ? val.replace(/\D/g, '') : val;
      }
      case 'postal': {
        if (!v.postal) return '';
        const d = v.postal.replace(/\D/g, '');
        if (typeof info.part === 'number') return info.part === 0 ? d.slice(0, 3) : d.slice(3);
        if (info.noHyphen || (info.el.maxLength > 0 && info.el.maxLength < 8)) return d;
        return `${d.slice(0, 3)}-${d.slice(3)}`;
      }
      case 'prefecture': return info.el.tagName === 'SELECT' ? [v.prefecture, v.prefecture?.replace(/[都府県]$/, ''), v.prefectureEn] : en ? v.prefectureEn : v.prefecture;
      case 'city': return en ? v.cityEn : v.city;
      case 'street':
        if (en) return flags.city ? v.line1En : [v.line1En, v.cityEn].filter(Boolean).join(', ');
        return flags.city ? v.street : (v.city || '') + (v.street || '');
      case 'building': return en ? v.line2En : v.building;
      case 'address': {
        if (en) {
          return [v.line1En, flags.building ? '' : v.line2En, flags.city ? '' : v.cityEn, flags.prefecture ? '' : v.prefectureEn]
            .filter(Boolean).join(', ');
        }
        // 番地が英数字で終わるときだけ、建物名との間に空白を入れる（「1-2-3 〇〇ビル」）
        const sp = /[0-9a-z]$/i.test(v.street || '') ? ' ' : '';
        return (flags.prefecture ? '' : v.prefecture || '') + (flags.city ? '' : v.city || '') + (v.street || '') +
          (flags.building || !v.building ? '' : sp + v.building);
      }
      case 'country': return info.el.tagName === 'SELECT' ? ['日本', 'Japan', 'jp', 'jpn'] : en ? 'Japan' : '日本';
      case 'company': return v.company;
      case 'department': return v.department;
      case 'gender': {
        if (!v.gender) return '';
        if (info.el.tagName === 'SELECT') return { male: ['男性', '男', 'male', 'm'], female: ['女性', '女', 'female', 'f'], other: ['その他', '回答しない', 'other'] }[v.gender];
        return en ? { male: 'Male', female: 'Female', other: 'Other' }[v.gender] : { male: '男性', female: '女性', other: 'その他' }[v.gender];
      }
      case 'birthday': {
        const b = v.birth;
        if (!b) return '';
        const w = b.wareki;
        switch (info.part) {
          case 'iso': return `${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
          case 'era': return w ? [w.era.ja, w.era.en, w.era.short] : '';
          case 'eraYear': return w ? (info.el.tagName === 'SELECT' ? [w.year] : String(w.year)) : '';
          case 'year':
            if (info.useWareki) return w ? (info.el.tagName === 'SELECT' ? [w.year] : String(w.year)) : '';
            return info.el.tagName === 'SELECT' ? [b.y] : String(b.y);
          case 'month': return info.el.tagName === 'SELECT' ? [b.m] : String(b.m).padStart(2, '0');
          case 'day': return info.el.tagName === 'SELECT' ? [b.d] : String(b.d).padStart(2, '0');
          default: return info.el.tagName === 'SELECT' ? '' : formatDate(info, b);
        }
      }
    }
    return '';
  }

  // ---- 値を入れる --------------------------------------------------------------

  function pickOption(sel, cands) {
    const opts = [...sel.options].filter((o) => !o.disabled && o.value !== '');
    const key = (s) => norm(s).replace(/\s/g, '');
    for (const c of cands.filter((x) => x !== '' && x != null)) {
      if (typeof c === 'number') {
        const hit = opts.find((o) => {
          const n = parseInt(norm(o.text).replace(/元/, '1').match(/\d+/)?.[0] ?? norm(o.value).match(/\d+/)?.[0], 10);
          return n === c;
        });
        if (hit) return hit;
        continue;
      }
      const k = key(c);
      const hit = opts.find((o) => key(o.text) === k || key(o.value) === k) ||
        (k.length >= 2 ? opts.find((o) => { const t = key(o.text); return t.length >= 2 && (t.startsWith(k) || k.startsWith(t)); }) : null);
      if (hit) return hit;
    }
    return null;
  }

  function setValue(el, value) {
    if (el.tagName === 'SELECT') {
      const opt = pickOption(el, Array.isArray(value) ? value : [value]);
      if (!opt) return false;
      el.value = opt.value;
    } else {
      if (!value) return false;
      // React などが値の変化に気づけるよう、プロトタイプの setter を使う
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // 郵便番号から住所を引くスクリプト（ajaxzip3 など）は keyup で動くことが多い
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    el.dispatchEvent(new Event('blur'));
    return true;
  }

  function setRadio(info, gender) {
    const re = { male: /(^|[^女])男|^(m|male|man)$|(^|[^e])male/, female: /女|female|woman|^f$/, other: /その他|回答しない|答えない|other|prefer|non-?binary/ }[gender];
    if (!re) return false;
    // 「female」が「male」に当たらないよう、女性を先に除く
    const idx = info.labels.findIndex((l) => (gender === 'male' ? re.test(l) && !/女|female/.test(l) : re.test(l)));
    if (idx < 0) return false;
    const r = info.radios[idx];
    if (!r.checked) r.click();
    return true;
  }

  const MARK = 'data-form-autofill-jp';
  function highlight(els) {
    if (!document.getElementById(MARK)) {
      const st = document.createElement('style');
      st.id = MARK;
      st.textContent = `[${MARK}]{outline:2px solid #16a34a !important;outline-offset:1px !important;transition:outline-color .6s}`;
      (document.head || document.documentElement).appendChild(st);
    }
    els.forEach((el) => el.setAttribute(MARK, ''));
    setTimeout(() => els.forEach((el) => el.removeAttribute(MARK)), 2500);
  }

  function pageModeOf() {
    const lang = (document.documentElement.lang || '').toLowerCase();
    if (lang.startsWith('ja')) return 'ja';
    if (lang && !lang.startsWith('ja')) return 'en';
    const t = (document.body?.textContent || '').slice(0, 3000);
    return (t.match(/[぀-ヿ一-鿿]/g) || []).length > 20 ? 'ja' : 'en';
  }

  // 欄を見分けた結果だけを返す（入力はしない）。動作の確かめに使う
  function scan() {
    const pageMode = pageModeOf();
    const els = [...document.querySelectorAll('input, select, textarea')].filter(eligible);
    const infos = els.filter((el) => el.type !== 'radio').map((el) => analyze(el, pageMode)).filter(Boolean);
    infos.push(...radioGroups(els));
    infos.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    resolveGroups(infos);
    // 元号の欄がある行では、年の欄に和暦の年を入れる
    const rowOf = (el) => el.closest('tr,dd,li,fieldset,p') || el.parentElement;
    for (const x of infos) {
      if (x.kind === 'birthday' && x.part === 'year' && infos.some((y) => y.kind === 'birthday' && y.part === 'era' && rowOf(y.el) === rowOf(x.el))) x.useWareki = true;
    }
    return { infos };
  }

  async function fill(profile, { overwrite = false } = {}) {
    const v = derive(profile);
    const { infos } = scan();
    const targets = infos.filter((x) => overwrite || x.wasEmpty);
    const filled = [];
    const run = (list) => {
      for (const info of list) {
        const ok = info.radios ? setRadio(info, v.gender) : setValue(info.el, valueFor(info, v));
        if (ok) filled.push(info.el);
      }
    };
    // 郵便番号を先に入れ、住所の自動入力が終わってから残りを入れる（自動入力に上書きされないように）
    const postal = targets.filter((x) => x.kind === 'postal');
    run(postal);
    if (postal.length && targets.length > postal.length) await new Promise((r) => setTimeout(r, 500));
    run(targets.filter((x) => x.kind !== 'postal'));
    highlight(filled);
    return { filled: filled.length, found: infos.length };
  }

  globalThis.__formAutofillJp = { fill, scan, derive, PREFS, valueFor, toHiragana, toKatakana, toHalfKana, toWareki };
})();
