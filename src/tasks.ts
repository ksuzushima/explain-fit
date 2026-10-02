/**
 * 架空の制度だけを用い、既有知識や実生活での正解に依存しない課題集。
 * 同じ pairId の2課題は、規則の論理構造・設問の推論段数をそろえた並行課題。
 * 各本課題は検索1問＋適用3問。初回と再検査では題材・用語・具体値を変えている。
 * ペア1は独立加算、ペア2は加算後の上限、ペア3は優先順位つき例外、
 * ペア4は独立した2組のAND条件。文字数と構造の一致は妥当性検証の代わりではない。
 * 表示条件で本文を書き換えない。連続文は paragraphs.join('')、分割文は同じ配列順。
 * 見出し・箇条書き・強調を本文に埋め込まず、異なる条件に情報差を持ち込まない。
 * 誤答肢は1規則の見落とし・上限の未適用・優先順位の逆転などから作成。
 */
export interface Question {
  id: string;
  kind: 'retrieval' | 'application';
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Task {
  id: string;
  set: 'practice' | 'initial' | 'retest';
  pairId: string;
  title: string;
  paragraphs: string[];
  questions: Question[];
}

export const TASKS: Task[] = [
  {
    id: 'practice-1', set: 'practice', pairId: 'practice', title: '小波の札分け',
    paragraphs: [
      '小波の受付では、札を二つの箱に分けます。丸い印がある札は白い箱へ、丸い印がない札は黒い箱へ入れます。',
      '札の色や大きさでは行き先は変わりません。丸い印が一つでもあれば、白い箱に入れます。'
    ],
    questions: [
      { id: 'practice-1-q1', kind: 'retrieval', prompt: '丸い印がある札は、どの箱に入れますか。', options: ['白い箱', '黒い箱', 'どちらでもよい', 'どちらにも入れない'], correctIndex: 0, explanation: '丸い印がある札の行き先は、白い箱です。' },
      { id: 'practice-1-q2', kind: 'application', prompt: '大きな青い札に、丸い印が一つあります。行き先はどこですか。', options: ['黒い箱', 'どちらでもよい', '白い箱', 'どちらにも入れない'], correctIndex: 2, explanation: '色と大きさは関係なく、丸い印があるので白い箱です。' },
      { id: 'practice-1-q3', kind: 'application', prompt: '小さな赤い札に、丸い印はありません。行き先はどこですか。', options: ['どちらにも入れない', '黒い箱', '白い箱', 'どちらでもよい'], correctIndex: 1, explanation: '丸い印がないので、黒い箱です。' },
      { id: 'practice-1-q4', kind: 'application', prompt: '黒い色の札に、丸い印が二つあります。行き先はどこですか。', options: ['どちらでもよい', '黒い箱', 'どちらにも入れない', '白い箱'], correctIndex: 3, explanation: '札の色ではなく印の有無で決まります。丸い印があるので白い箱です。' }
    ]
  },
  {
    id: 'practice-2', set: 'practice', pairId: 'practice', title: '葉音の交換所',
    paragraphs: [
      '葉音の交換所では、一人にまず券を二枚渡します。星の印がある人には、さらに一枚を加えます。',
      '緑の帯がある人にも、さらに二枚を加えます。星の印と緑の帯が両方ある場合は、両方の追加分を加えます。'
    ],
    questions: [
      { id: 'practice-2-q1', kind: 'retrieval', prompt: '星の印によって追加される券は何枚ですか。', options: ['二枚', '三枚', '一枚', '四枚'], correctIndex: 2, explanation: '星の印がある場合の追加分は一枚です。' },
      { id: 'practice-2-q2', kind: 'application', prompt: '星の印があり、緑の帯がない人は、券を合計何枚受け取りますか。', options: ['三枚', '一枚', '二枚', '五枚'], correctIndex: 0, explanation: '最初の二枚に、星の印の一枚を加えて三枚です。' },
      { id: 'practice-2-q3', kind: 'application', prompt: '星の印はなく、緑の帯がある人は、券を合計何枚受け取りますか。', options: ['二枚', '三枚', '五枚', '四枚'], correctIndex: 3, explanation: '最初の二枚に、緑の帯の二枚を加えて四枚です。' },
      { id: 'practice-2-q4', kind: 'application', prompt: '星の印と緑の帯が両方ある人は、券を合計何枚受け取りますか。', options: ['三枚', '五枚', '四枚', '二枚'], correctIndex: 1, explanation: '二枚に一枚と二枚を加えるので、合計五枚です。' }
    ]
  },
  {
    id: 'initial-1', set: 'initial', pairId: 'initial-pair-1', title: '波庭工房の箱札',
    paragraphs: [
      '波庭工房では、箱につける札を見て、その箱に入れる玉の数を決めます。どの箱にも、最初に玉を二個入れます。箱の大きさや届け先によって、この最初の数は変わりません。',
      '札が青色なら三個、丸い印があれば一個、銀色のひもがついていれば二個を、それぞれ追加します。当てはまらない条件の分は追加しません。',
      '三つの条件は別々に調べます。複数に当てはまる場合は、当てはまった分をすべて最初の二個に加えます。合計の上限や、ほかの数の変更はありません。'
    ],
    questions: [
      { id: 'initial-1-q1', kind: 'retrieval', prompt: '銀色のひもがあるとき、追加する玉は何個ですか。', options: ['一個', '三個', '二個', '四個'], correctIndex: 2, explanation: '銀色のひもによる追加分は二個です。最初の二個とは別です。' },
      { id: 'initial-1-q2', kind: 'application', prompt: '青い札に丸い印があり、銀色のひもはありません。玉は合計何個ですか。', options: ['六個', '四個', '五個', '八個'], correctIndex: 0, explanation: '最初の二個＋青色の三個＋丸い印の一個で、六個です。' },
      { id: 'initial-1-q3', kind: 'application', prompt: '札は白色で、丸い印と銀色のひもがあります。玉は合計何個ですか。', options: ['三個', '四個', '七個', '五個'], correctIndex: 3, explanation: '青色の追加はありません。二個＋丸い印の一個＋ひもの二個で、五個です。' },
      { id: 'initial-1-q4', kind: 'application', prompt: '青い札に丸い印と銀色のひもがあります。玉は合計何個ですか。', options: ['六個', '八個', '七個', '五個'], correctIndex: 1, explanation: '三つの追加分をすべて加え、二個＋三個＋一個＋二個で八個です。' }
    ]
  },
  {
    id: 'initial-2', set: 'initial', pairId: 'initial-pair-1', title: '星野倉庫の荷札',
    paragraphs: [
      '星野倉庫では、荷物につける札を見て、その荷物に添える輪の数を決めます。どの荷物にも、最初に輪を三個添えます。荷物の重さや受取人によって、この最初の数は変わりません。',
      '札が緑色なら二個、三角の印があれば一個、金色のひもがついていれば三個を、それぞれ追加します。当てはまらない条件の分は追加しません。',
      '三つの条件は別々に調べます。複数に当てはまる場合は、当てはまった分をすべて最初の三個に加えます。合計の上限や、ほかの数の変更はありません。'
    ],
    questions: [
      { id: 'initial-2-q1', kind: 'retrieval', prompt: '金色のひもがあるとき、追加する輪は何個ですか。', options: ['一個', '三個', '二個', '四個'], correctIndex: 1, explanation: '金色のひもによる追加分は三個です。最初の三個とは別です。' },
      { id: 'initial-2-q2', kind: 'application', prompt: '緑の札に三角の印があり、金色のひもはありません。輪は合計何個ですか。', options: ['三個', '五個', '九個', '六個'], correctIndex: 3, explanation: '最初の三個＋緑色の二個＋三角の印の一個で、六個です。' },
      { id: 'initial-2-q3', kind: 'application', prompt: '札は白色で、三角の印と金色のひもがあります。輪は合計何個ですか。', options: ['七個', '四個', '六個', '九個'], correctIndex: 0, explanation: '緑色の追加はありません。三個＋三角の印の一個＋ひもの三個で、七個です。' },
      { id: 'initial-2-q4', kind: 'application', prompt: '緑の札に三角の印と金色のひもがあります。輪は合計何個ですか。', options: ['六個', '八個', '九個', '七個'], correctIndex: 2, explanation: '三つの追加分をすべて加え、三個＋二個＋一個＋三個で九個です。' }
    ]
  },
  {
    id: 'initial-3', set: 'initial', pairId: 'initial-pair-2', title: '雲灯店の交換券',
    paragraphs: [
      '雲灯店では、来店した人のカードを見て、交換券の枚数を決めます。全員にまず二枚を用意し、カードに押された印一個につき二枚を加えます。印は、ついている個数だけ数えます。',
      'さらに、朝の受付を通った人には三枚を加えます。朝の受付を通らなかった人には、この三枚は加えません。印による追加と朝の追加は、両方を受けられます。',
      'ただし、実際に渡す交換券は一人九枚までです。すべての追加を済ませた合計が九枚を超えたら九枚にし、九枚以下なら計算した枚数をそのまま渡します。'
    ],
    questions: [
      { id: 'initial-3-q1', kind: 'retrieval', prompt: '一人に渡す交換券は、最大何枚ですか。', options: ['六枚', '八枚', '十一枚', '九枚'], correctIndex: 3, explanation: 'すべての追加後に適用する上限は九枚です。' },
      { id: 'initial-3-q2', kind: 'application', prompt: '印が一個で、朝の受付を通らなかった人には、何枚渡しますか。', options: ['二枚', '四枚', '五枚', '七枚'], correctIndex: 1, explanation: '最初の二枚＋印一個の二枚で四枚です。上限を超えません。' },
      { id: 'initial-3-q3', kind: 'application', prompt: '印が二個で、朝の受付を通った人には、何枚渡しますか。', options: ['七枚', '六枚', '九枚', '十一枚'], correctIndex: 2, explanation: '二枚＋二個×二枚＋朝の三枚で九枚です。上限と同じなので九枚渡します。' },
      { id: 'initial-3-q4', kind: 'application', prompt: '印が三個で、朝の受付を通った人には、何枚渡しますか。', options: ['九枚', '八枚', '十一枚', '六枚'], correctIndex: 0, explanation: '二枚＋三個×二枚＋三枚は十一枚ですが、上限を適用して九枚です。' }
    ]
  },
  {
    id: 'initial-4', set: 'initial', pairId: 'initial-pair-2', title: '森影広場の遊び券',
    paragraphs: [
      '森影広場では、参加した人の台紙を見て、遊び券の枚数を決めます。全員にまず一枚を用意し、台紙に貼られた印一個につき三枚を加えます。印は、ついている個数だけ数えます。',
      'さらに、昼の案内を聞いた人には二枚を加えます。昼の案内を聞かなかった人には、この二枚は加えません。印による追加と昼の追加は、両方を受けられます。',
      'ただし、実際に渡す遊び券は一人九枚までです。すべての追加を済ませた合計が九枚を超えたら九枚にし、九枚以下なら計算した枚数をそのまま渡します。'
    ],
    questions: [
      { id: 'initial-4-q1', kind: 'retrieval', prompt: '一人に渡す遊び券は、最大何枚ですか。', options: ['九枚', '六枚', '十枚', '十二枚'], correctIndex: 0, explanation: 'すべての追加後に適用する上限は九枚です。' },
      { id: 'initial-4-q2', kind: 'application', prompt: '印が一個で、昼の案内を聞かなかった人には、何枚渡しますか。', options: ['三枚', '一枚', '四枚', '六枚'], correctIndex: 2, explanation: '最初の一枚＋印一個の三枚で四枚です。上限を超えません。' },
      { id: 'initial-4-q3', kind: 'application', prompt: '印が二個で、昼の案内を聞いた人には、何枚渡しますか。', options: ['六枚', '七枚', '十二枚', '九枚'], correctIndex: 3, explanation: '一枚＋二個×三枚＋昼の二枚で九枚です。上限と同じなので九枚渡します。' },
      { id: 'initial-4-q4', kind: 'application', prompt: '印が三個で、昼の案内を聞いた人には、何枚渡しますか。', options: ['十枚', '九枚', '十二枚', '七枚'], correctIndex: 1, explanation: '一枚＋三個×三枚＋二枚は十二枚ですが、上限を適用して九枚です。' }
    ]
  },
  {
    id: 'initial-5', set: 'initial', pairId: 'initial-pair-3', title: '月砂便の仕分け室',
    paragraphs: [
      '月砂便では、封筒を四つの部屋のどれか一つに運びます。特別な印が何もない封筒は、一号室へ運びます。三角の印がある封筒は二号室へ、赤い縁がある封筒は三号室へ運びます。',
      '三角の印と赤い縁が両方ある場合は、赤い縁の規則を優先して三号室へ運びます。同じ封筒を複数の部屋に運ぶことはありません。',
      'ただし、封印がついた封筒は、ほかの印にかかわらず四号室へ運びます。封印の規則がいちばん優先です。封印がない場合だけ、三角の印と赤い縁の規則を使います。'
    ],
    questions: [
      { id: 'initial-5-q1', kind: 'retrieval', prompt: '封印がついている封筒の行き先はどこですか。', options: ['二号室', '四号室', '一号室', '三号室'], correctIndex: 1, explanation: '封印がある場合は、ほかの印にかかわらず四号室です。' },
      { id: 'initial-5-q2', kind: 'application', prompt: '三角の印があり、赤い縁も封印もない封筒は、どこへ運びますか。', options: ['一号室', '三号室', '四号室', '二号室'], correctIndex: 3, explanation: '三角の印だけが当てはまるので、二号室です。' },
      { id: 'initial-5-q3', kind: 'application', prompt: '三角の印と赤い縁があり、封印はない封筒は、どこへ運びますか。', options: ['三号室', '二号室', '一号室', '四号室'], correctIndex: 0, explanation: '赤い縁の規則が三角の印より優先するので、三号室です。' },
      { id: 'initial-5-q4', kind: 'application', prompt: '三角の印、赤い縁、封印がすべてある封筒は、どこへ運びますか。', options: ['三号室', '一号室', '四号室', '二号室'], correctIndex: 2, explanation: '封印の規則が最優先なので、ほかの二つの印があっても四号室です。' }
    ]
  },
  {
    id: 'initial-6', set: 'initial', pairId: 'initial-pair-3', title: '天音書庫の返却棚',
    paragraphs: [
      '天音書庫では、本を四つの棚のどれか一つに戻します。特別な印が何もない本は、東棚へ戻します。四角の印がある本は南棚へ、紫のシールがある本は西棚へ戻します。',
      '四角の印と紫のシールが両方ある場合は、紫のシールの規則を優先して西棚へ戻します。同じ本を複数の棚に戻すことはありません。',
      'ただし、リボンがついた本は、ほかの印にかかわらず中央棚へ戻します。リボンの規則がいちばん優先です。リボンがない場合だけ、四角の印と紫のシールの規則を使います。'
    ],
    questions: [
      { id: 'initial-6-q1', kind: 'retrieval', prompt: 'リボンがついている本の行き先はどこですか。', options: ['東棚', '南棚', '中央棚', '西棚'], correctIndex: 2, explanation: 'リボンがある場合は、ほかの印にかかわらず中央棚です。' },
      { id: 'initial-6-q2', kind: 'application', prompt: '四角の印があり、紫のシールもリボンもない本は、どこへ戻しますか。', options: ['南棚', '東棚', '西棚', '中央棚'], correctIndex: 0, explanation: '四角の印だけが当てはまるので、南棚です。' },
      { id: 'initial-6-q3', kind: 'application', prompt: '四角の印と紫のシールがあり、リボンはない本は、どこへ戻しますか。', options: ['中央棚', '南棚', '東棚', '西棚'], correctIndex: 3, explanation: '紫のシールの規則が四角の印より優先するので、西棚です。' },
      { id: 'initial-6-q4', kind: 'application', prompt: '四角の印、紫のシール、リボンがすべてある本は、どこへ戻しますか。', options: ['西棚', '中央棚', '南棚', '東棚'], correctIndex: 1, explanation: 'リボンの規則が最優先なので、ほかの二つの印があっても中央棚です。' }
    ]
  },
  {
    id: 'initial-7', set: 'initial', pairId: 'initial-pair-4', title: '浮舟庭園の入場札',
    paragraphs: [
      '浮舟庭園には、灯り窓と音の窓という二つの見学場所があります。入場札の特徴を見て、使える場所を決めます。灯り窓を使うには、青い札であることと丸い印があることの両方が必要です。',
      '音の窓を使うには、札の角が折ってあることと白い縁があることの両方が必要です。それぞれの組で、一方だけを満たしていても、その場所は使えません。',
      '二つの場所の条件は別々に確かめます。両方の組を満たせば両方を使え、片方の組だけならその場所だけを使えます。どちらの組も満たさなければ、どちらも使えません。'
    ],
    questions: [
      { id: 'initial-7-q1', kind: 'retrieval', prompt: '灯り窓を使うために必要な組み合わせはどれですか。', options: ['青い札と白い縁', '丸い印と折った角', '折った角と白い縁', '青い札と丸い印'], correctIndex: 3, explanation: '灯り窓の条件は、青い札と丸い印の両方です。' },
      { id: 'initial-7-q2', kind: 'application', prompt: '青い札で丸い印があり、角は折ってありますが白い縁はありません。使える場所はどれですか。', options: ['音の窓だけ', '灯り窓だけ', '両方', 'どちらも使えない'], correctIndex: 1, explanation: '灯り窓の二条件はそろっています。音の窓は白い縁がないため使えません。' },
      { id: 'initial-7-q3', kind: 'application', prompt: '青い札ですが丸い印はなく、角は折ってあり白い縁があります。使える場所はどれですか。', options: ['灯り窓だけ', '両方', '音の窓だけ', 'どちらも使えない'], correctIndex: 2, explanation: '音の窓の二条件はそろっています。灯り窓は丸い印がないため使えません。' },
      { id: 'initial-7-q4', kind: 'application', prompt: '青い札に丸い印があり、角は折ってあり白い縁もあります。使える場所はどれですか。', options: ['両方', '灯り窓だけ', '音の窓だけ', 'どちらも使えない'], correctIndex: 0, explanation: '二つの場所それぞれの二条件をすべて満たすので、両方を使えます。' }
    ]
  },
  {
    id: 'initial-8', set: 'initial', pairId: 'initial-pair-4', title: '花時計館の体験票',
    paragraphs: [
      '花時計館には、影の机と風の机という二つの体験場所があります。体験票の特徴を見て、使える場所を決めます。影の机を使うには、黄色い票であることと星の印があることの両方が必要です。',
      '風の机を使うには、票に穴が開いていることと黒い帯があることの両方が必要です。それぞれの組で、一方だけを満たしていても、その場所は使えません。',
      '二つの場所の条件は別々に確かめます。両方の組を満たせば両方を使え、片方の組だけならその場所だけを使えます。どちらの組も満たさなければ、どちらも使えません。'
    ],
    questions: [
      { id: 'initial-8-q1', kind: 'retrieval', prompt: '影の机を使うために必要な組み合わせはどれですか。', options: ['黄色い票と星の印', '星の印と穴', '黄色い票と黒い帯', '穴と黒い帯'], correctIndex: 0, explanation: '影の机の条件は、黄色い票と星の印の両方です。' },
      { id: 'initial-8-q2', kind: 'application', prompt: '黄色い票で星の印があり、穴はありますが黒い帯はありません。使える場所はどれですか。', options: ['風の机だけ', '両方', '影の机だけ', 'どちらも使えない'], correctIndex: 2, explanation: '影の机の二条件はそろっています。風の机は黒い帯がないため使えません。' },
      { id: 'initial-8-q3', kind: 'application', prompt: '黄色い票ですが星の印はなく、穴があり黒い帯もあります。使える場所はどれですか。', options: ['影の机だけ', '両方', 'どちらも使えない', '風の机だけ'], correctIndex: 3, explanation: '風の机の二条件はそろっています。影の机は星の印がないため使えません。' },
      { id: 'initial-8-q4', kind: 'application', prompt: '黄色い票に星の印があり、穴があり黒い帯もあります。使える場所はどれですか。', options: ['影の机だけ', '両方', '風の机だけ', 'どちらも使えない'], correctIndex: 1, explanation: '二つの場所それぞれの二条件をすべて満たすので、両方を使えます。' }
    ]
  },
  {
    id: 'retest-1', set: 'retest', pairId: 'retest-pair-1', title: '砂丘観測所の記録票',
    paragraphs: [
      '砂丘観測所では、記録票の特徴から、その記録に与える点数を決めます。どの記録にも、最初に一点をつけます。記録を書いた時刻や書いた人によって、この最初の点数は変わりません。',
      '票が紫色なら二点、波の印があれば三点、白いシールがついていれば一点を、それぞれ追加します。当てはまらない条件の分は追加しません。',
      '三つの条件は別々に調べます。複数に当てはまる場合は、当てはまった分をすべて最初の一点に加えます。合計の上限や、ほかの点数の変更はありません。'
    ],
    questions: [
      { id: 'retest-1-q1', kind: 'retrieval', prompt: '白いシールがあるとき、追加する点数は何点ですか。', options: ['二点', '一点', '三点', '四点'], correctIndex: 1, explanation: '白いシールによる追加分は一点です。最初の一点とは別です。' },
      { id: 'retest-1-q2', kind: 'application', prompt: '紫の票に波の印があり、白いシールはありません。合計は何点ですか。', options: ['三点', '四点', '七点', '六点'], correctIndex: 3, explanation: '最初の一点＋紫色の二点＋波の印の三点で、六点です。' },
      { id: 'retest-1-q3', kind: 'application', prompt: '票は灰色で、波の印と白いシールがあります。合計は何点ですか。', options: ['五点', '四点', '二点', '七点'], correctIndex: 0, explanation: '紫色の追加はありません。一点＋波の印の三点＋シールの一点で、五点です。' },
      { id: 'retest-1-q4', kind: 'application', prompt: '紫の票に波の印と白いシールがあります。合計は何点ですか。', options: ['六点', '四点', '七点', '五点'], correctIndex: 2, explanation: '三つの追加分をすべて加え、一点＋二点＋三点＋一点で七点です。' }
    ]
  },
  {
    id: 'retest-2', set: 'retest', pairId: 'retest-pair-1', title: '虹原工場の完成札',
    paragraphs: [
      '虹原工場では、完成札の特徴から、その品物に添える石の数を決めます。どの品物にも、最初に石を二個添えます。品物を作った時刻や担当者によって、この最初の数は変わりません。',
      '札が橙色なら三個、花の印があれば二個、黒い糸がついていれば一個を、それぞれ追加します。当てはまらない条件の分は追加しません。',
      '三つの条件は別々に調べます。複数に当てはまる場合は、当てはまった分をすべて最初の二個に加えます。合計の上限や、ほかの数の変更はありません。'
    ],
    questions: [
      { id: 'retest-2-q1', kind: 'retrieval', prompt: '黒い糸があるとき、追加する石は何個ですか。', options: ['二個', '三個', '一個', '四個'], correctIndex: 2, explanation: '黒い糸による追加分は一個です。最初の二個とは別です。' },
      { id: 'retest-2-q2', kind: 'application', prompt: '橙色の札に花の印があり、黒い糸はありません。石は合計何個ですか。', options: ['七個', '五個', '四個', '八個'], correctIndex: 0, explanation: '最初の二個＋橙色の三個＋花の印の二個で、七個です。' },
      { id: 'retest-2-q3', kind: 'application', prompt: '札は灰色で、花の印と黒い糸があります。石は合計何個ですか。', options: ['三個', '四個', '八個', '五個'], correctIndex: 3, explanation: '橙色の追加はありません。二個＋花の印の二個＋糸の一個で、五個です。' },
      { id: 'retest-2-q4', kind: 'application', prompt: '橙色の札に花の印と黒い糸があります。石は合計何個ですか。', options: ['七個', '八個', '五個', '六個'], correctIndex: 1, explanation: '三つの追加分をすべて加え、二個＋三個＋二個＋一個で八個です。' }
    ]
  },
  {
    id: 'retest-3', set: 'retest', pairId: 'retest-pair-2', title: '水葉市の灯り玉',
    paragraphs: [
      '水葉市では、参加者の手帳を見て、持ち帰れる灯り玉の数を決めます。全員にまず三個を用意し、手帳にある葉の印一個につき二個を加えます。印は、ついている個数だけ数えます。',
      'さらに、入口で合言葉を伝えた人には灯り玉を一個加えます。合言葉を伝えなかった人には、この一個は加えません。印による追加と合言葉による追加は、一人で両方を受けられます。',
      'ただし、実際に渡す灯り玉は一人八個までです。すべての追加を済ませた合計が八個を超えたら八個にし、八個以下なら計算した個数をそのまま渡します。'
    ],
    questions: [
      { id: 'retest-3-q1', kind: 'retrieval', prompt: '一人に渡す灯り玉は、最大何個ですか。', options: ['八個', '七個', '九個', '十個'], correctIndex: 0, explanation: 'すべての追加後に適用する上限は八個です。' },
      { id: 'retest-3-q2', kind: 'application', prompt: '葉の印が一個で、合言葉を伝えなかった人には、何個渡しますか。', options: ['三個', '六個', '五個', '八個'], correctIndex: 2, explanation: '最初の三個＋印一個の二個で五個です。上限を超えません。' },
      { id: 'retest-3-q3', kind: 'application', prompt: '葉の印が二個で、合言葉を伝えた人には、何個渡しますか。', options: ['七個', '六個', '十個', '八個'], correctIndex: 3, explanation: '三個＋二個×二個＋合言葉の一個で八個です。上限と同じなので八個渡します。' },
      { id: 'retest-3-q4', kind: 'application', prompt: '葉の印が三個で、合言葉を伝えた人には、何個渡しますか。', options: ['九個', '八個', '十個', '七個'], correctIndex: 1, explanation: '三個＋三個×二個＋一個は十個ですが、上限を適用して八個です。' }
    ]
  },
  {
    id: 'retest-4', set: 'retest', pairId: 'retest-pair-2', title: '石響館の音片',
    paragraphs: [
      '石響館では、来館者の記録帳を見て、持ち帰れる音片の数を決めます。全員にまず二個を用意し、記録帳にある羽の印一個につき三個を加えます。印は、ついている個数だけ数えます。',
      'さらに、出口で名札を見せた人には音片を一個加えます。名札を見せなかった人には、この一個は加えません。印による追加と名札による追加は、一人で両方を受けられます。',
      'ただし、実際に渡す音片は一人九個までです。すべての追加を済ませた合計が九個を超えたら九個にし、九個以下なら計算した個数をそのまま渡します。'
    ],
    questions: [
      { id: 'retest-4-q1', kind: 'retrieval', prompt: '一人に渡す音片は、最大何個ですか。', options: ['七個', '八個', '十一個', '九個'], correctIndex: 3, explanation: 'すべての追加後に適用する上限は九個です。' },
      { id: 'retest-4-q2', kind: 'application', prompt: '羽の印が一個で、名札を見せなかった人には、何個渡しますか。', options: ['二個', '五個', '六個', '八個'], correctIndex: 1, explanation: '最初の二個＋印一個の三個で五個です。上限を超えません。' },
      { id: 'retest-4-q3', kind: 'application', prompt: '羽の印が二個で、名札を見せた人には、何個渡しますか。', options: ['八個', '六個', '九個', '十二個'], correctIndex: 2, explanation: '二個＋二個×三個＋名札の一個で九個です。上限と同じなので九個渡します。' },
      { id: 'retest-4-q4', kind: 'application', prompt: '羽の印が三個で、名札を見せた人には、何個渡しますか。', options: ['九個', '十一個', '十二個', '八個'], correctIndex: 0, explanation: '二個＋三個×三個＋一個は十二個ですが、上限を適用して九個です。' }
    ]
  },
  {
    id: 'retest-5', set: 'retest', pairId: 'retest-pair-3', title: '水輪駅の伝言板',
    paragraphs: [
      '水輪駅では、伝言札を四つの板のどれか一つに貼ります。特別な印が何もない札は、白い板に貼ります。星の印がある札は青い板に、二重線がある札は緑の板に貼ります。',
      '星の印と二重線が両方ある場合は、二重線の規則を優先して緑の板に貼ります。同じ札を複数の板に貼ることはありません。',
      'ただし、黒い点がついた札は、ほかの印にかかわらず黄色い板に貼ります。黒い点の規則がいちばん優先です。黒い点がない場合だけ、星の印と二重線の規則を使います。'
    ],
    questions: [
      { id: 'retest-5-q1', kind: 'retrieval', prompt: '黒い点がついている札の行き先はどこですか。', options: ['青い板', '緑の板', '黄色い板', '白い板'], correctIndex: 2, explanation: '黒い点がある場合は、ほかの印にかかわらず黄色い板です。' },
      { id: 'retest-5-q2', kind: 'application', prompt: '星の印があり、二重線も黒い点もない札は、どこに貼りますか。', options: ['青い板', '白い板', '緑の板', '黄色い板'], correctIndex: 0, explanation: '星の印だけが当てはまるので、青い板です。' },
      { id: 'retest-5-q3', kind: 'application', prompt: '星の印と二重線があり、黒い点はない札は、どこに貼りますか。', options: ['白い板', '青い板', '黄色い板', '緑の板'], correctIndex: 3, explanation: '二重線の規則が星の印より優先するので、緑の板です。' },
      { id: 'retest-5-q4', kind: 'application', prompt: '星の印、二重線、黒い点がすべてある札は、どこに貼りますか。', options: ['緑の板', '黄色い板', '白い板', '青い板'], correctIndex: 1, explanation: '黒い点の規則が最優先なので、ほかの二つの印があっても黄色い板です。' }
    ]
  },
  {
    id: 'retest-6', set: 'retest', pairId: 'retest-pair-3', title: '木霧舎の展示台',
    paragraphs: [
      '木霧舎では、作品を四つの台のどれか一つに置きます。特別な印が何もない作品は、低い台に置きます。葉の印がある作品は丸い台に、しま模様がある作品は細い台に置きます。',
      '葉の印としま模様が両方ある場合は、しま模様の規則を優先して細い台に置きます。同じ作品を複数の台に置くことはありません。',
      'ただし、銀の留め具がついた作品は、ほかの印にかかわらず高い台に置きます。銀の留め具の規則がいちばん優先です。留め具がない場合だけ、葉の印としま模様の規則を使います。'
    ],
    questions: [
      { id: 'retest-6-q1', kind: 'retrieval', prompt: '銀の留め具がついている作品の行き先はどこですか。', options: ['低い台', '高い台', '丸い台', '細い台'], correctIndex: 1, explanation: '銀の留め具がある場合は、ほかの印にかかわらず高い台です。' },
      { id: 'retest-6-q2', kind: 'application', prompt: '葉の印があり、しま模様も留め具もない作品は、どこに置きますか。', options: ['低い台', '細い台', '高い台', '丸い台'], correctIndex: 3, explanation: '葉の印だけが当てはまるので、丸い台です。' },
      { id: 'retest-6-q3', kind: 'application', prompt: '葉の印としま模様があり、留め具はない作品は、どこに置きますか。', options: ['細い台', '丸い台', '低い台', '高い台'], correctIndex: 0, explanation: 'しま模様の規則が葉の印より優先するので、細い台です。' },
      { id: 'retest-6-q4', kind: 'application', prompt: '葉の印、しま模様、銀の留め具がすべてある作品は、どこに置きますか。', options: ['細い台', '丸い台', '高い台', '低い台'], correctIndex: 2, explanation: '銀の留め具の規則が最優先なので、ほかの二つの印があっても高い台です。' }
    ]
  },
  {
    id: 'retest-7', set: 'retest', pairId: 'retest-pair-4', title: '風粒室の道具札',
    paragraphs: [
      '風粒室には、光の輪と音の筒という二つの貸し道具があります。道具札の特徴を見て、借りられる道具を決めます。光の輪を借りるには、赤い札であることと四角の印があることの両方が必要です。',
      '音の筒を借りるには、札に切り込みがあることと青い線があることの両方が必要です。それぞれの組で、一方だけを満たしていても、その道具は借りられません。',
      '二つの道具の条件は別々に確かめます。両方の組を満たせば両方を借りられ、片方の組だけならその道具だけを借りられます。どちらの組も満たさなければ、どちらも借りられません。'
    ],
    questions: [
      { id: 'retest-7-q1', kind: 'retrieval', prompt: '光の輪を借りるために必要な組み合わせはどれですか。', options: ['赤い札と四角の印', '四角の印と青い線', '赤い札と切り込み', '切り込みと青い線'], correctIndex: 0, explanation: '光の輪の条件は、赤い札と四角の印の両方です。' },
      { id: 'retest-7-q2', kind: 'application', prompt: '赤い札で四角の印があり、切り込みはありますが青い線はありません。借りられる道具はどれですか。', options: ['音の筒だけ', '両方', '光の輪だけ', 'どちらも借りられない'], correctIndex: 2, explanation: '光の輪の二条件はそろっています。音の筒は青い線がないため借りられません。' },
      { id: 'retest-7-q3', kind: 'application', prompt: '赤い札ですが四角の印はなく、切り込みがあり青い線もあります。借りられる道具はどれですか。', options: ['光の輪だけ', '両方', 'どちらも借りられない', '音の筒だけ'], correctIndex: 3, explanation: '音の筒の二条件はそろっています。光の輪は四角の印がないため借りられません。' },
      { id: 'retest-7-q4', kind: 'application', prompt: '赤い札に四角の印があり、切り込みがあり青い線もあります。借りられる道具はどれですか。', options: ['光の輪だけ', '両方', '音の筒だけ', 'どちらも借りられない'], correctIndex: 1, explanation: '二つの道具それぞれの二条件をすべて満たすので、両方を借りられます。' }
    ]
  },
  {
    id: 'retest-8', set: 'retest', pairId: 'retest-pair-4', title: '朝霞園の作業票',
    paragraphs: [
      '朝霞園には、砂の筆と水のくしという二つの貸し道具があります。作業票の特徴を見て、借りられる道具を決めます。砂の筆を借りるには、緑の票であることと月の印があることの両方が必要です。',
      '水のくしを借りるには、票に折り線があることと金の点があることの両方が必要です。それぞれの組で、一方だけを満たしていても、その道具は借りられません。',
      '二つの道具の条件は別々に確かめます。両方の組を満たせば両方を借りられ、片方の組だけならその道具だけを借りられます。どちらの組も満たさなければ、どちらも借りられません。'
    ],
    questions: [
      { id: 'retest-8-q1', kind: 'retrieval', prompt: '砂の筆を借りるために必要な組み合わせはどれですか。', options: ['緑の票と金の点', '月の印と折り線', '折り線と金の点', '緑の票と月の印'], correctIndex: 3, explanation: '砂の筆の条件は、緑の票と月の印の両方です。' },
      { id: 'retest-8-q2', kind: 'application', prompt: '緑の票で月の印があり、折り線はありますが金の点はありません。借りられる道具はどれですか。', options: ['水のくしだけ', '砂の筆だけ', '両方', 'どちらも借りられない'], correctIndex: 1, explanation: '砂の筆の二条件はそろっています。水のくしは金の点がないため借りられません。' },
      { id: 'retest-8-q3', kind: 'application', prompt: '緑の票ですが月の印はなく、折り線があり金の点もあります。借りられる道具はどれですか。', options: ['砂の筆だけ', '両方', '水のくしだけ', 'どちらも借りられない'], correctIndex: 2, explanation: '水のくしの二条件はそろっています。砂の筆は月の印がないため借りられません。' },
      { id: 'retest-8-q4', kind: 'application', prompt: '緑の票に月の印があり、折り線があり金の点もあります。借りられる道具はどれですか。', options: ['両方', '砂の筆だけ', '水のくしだけ', 'どちらも借りられない'], correctIndex: 0, explanation: '二つの道具それぞれの二条件をすべて満たすので、両方を借りられます。' }
    ]
  }
];

export function getTask(id: string): Task {
  const task = TASKS.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`Unknown task: ${id}`);
  return task;
}
