
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

app.use(express.json());

// LINEとOpenAIの設定
require('dotenv').config();

const CHANNEL_SECRET = process.env.CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// `storeInfo.json`の読み込み
let storeInfo = {};
try {
    // JSONファイルを読み込む
    storeInfo = JSON.parse(fs.readFileSync('storeInfo.json', 'utf-8'));

    // menuプロパティが存在するか確認
    if (!Array.isArray(storeInfo.menu)) {
        console.error("Error: 'menu' is missing or invalid in storeInfo.json");
        storeInfo.menu = []; // デフォルト値を設定
    }
} catch (error) {
    console.error("Failed to read or parse storeInfo.json:", error.message);
    storeInfo = { menu: [] }; // デフォルト値を設定
}

// menuDescriptions を生成（menuが空でも安全に処理）
const menuDescriptions = storeInfo.menu.length
    ? storeInfo.menu.map(item => `${item.name} (${item.price}円)`).join(', ')
    : "メニュー情報がありません。";

console.log("Menu Descriptions:", menuDescriptions);

// LINEリクエスト署名の検証
function validateSignature(req) {
    const body = JSON.stringify(req.body);
    const signature = crypto.createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64');
    return req.headers['x-line-signature'] === signature;
}

// ChatGPTからの応答を取得
async function getChatGPTResponse(userMessage) {
    const systemMessage = `
        あなたは「高菜先生の郷土料理体験教室 富士家」のサポート担当AIです。
以下のルールに従い、お客様に適切な回答を提供してください。
1. 必ず「storeInfo」データを参照し、正確で詳細な情報を回答に含めてください。
2. 予約や利用について、基本的に「お断りしない」姿勢で対応してください。困難な場合でも「可能な限り対応いたします」「ご相談ください」とお答えください。
3. 予約案内時に電話番号をLINEで送らないでください。団体の問い合わせに限る。
4. ネガティブな表現（例: 「できません」「無理です」など）は使用せず、必ずポジティブかつ前向きな表現を使用してください。
5. 【予約リクエストフォーム】という文言で予約情報の返信があった場合には駐車場の案内を送ってください。
6. 店舗の特長、体験内容、メニュー、FAQ、ポリシーについては、storeInfo.json の内容を参照して正確に回答してください。
7. 必要に応じて「藍染体験」や「ほうとう作り」などの体験プランの詳細、料金、年齢制限なども回答に含めてください。
8. 質問が曖昧な場合でも、storeInfo 内の関連情報を検索し、適切な回答を試みてください。
9. 店舗や体験の利用に際してお客様が迷わないよう、地図やアクセス情報など具体的なサポート情報を含めてください。
10. 回答のトーンは常に丁寧かつ親切にし、「～です」「～ます」調で終わるようにしてください。
11. 見学の希望については絶対に断ってください。大人も子供も見学はできません。必ず何か体験してもらう。「見学」という文言がなくても全員参加しないというメッセージの場合は見学希望と同じ意味です。
12. 体験は3歳以上で参加可能ですので断らない。幼児は保護者と一緒に体験しますと補足情報を送る。4歳以下は無料になります。
13. 最小遂行人数は１人からで、すべてのメニューが対象です。例えばほうとう体験5名とそば体験1名のような予約も可能です。
14. 予約は営業時間内であれば好きな時間で構いません。
15. 猫は富士家にはいません。向かいの姉妹店アトリエ高菜先生にいます。
16. 団体予約の問い合わせ(団体、大人数などのワード)があった場合のみ電話番号とメールアドレスを伝えてください。団体予約は重要なのでスタッフが直接対応します。050-6882-5580とfujiya.taiken@gmail.com
17. 団体予約の場合はフォームを送らないでください。
18. セットのおすすめを聞かれたら「山梨名物土産セット、七味作りセット、染物セットが人気です」とおすすめしてください。
19. おすすめの体験は何かと聞かれたらほうとう体験、染物体験、七味作り体験が人気でおすすめですと答えてください。
21. 染物セットは藍染と麺作り体験のセットです。
22. 食べ放題はやってません。
23. 高菜先生とはSNSでも人気の当店の看板猫でお問い合わせされる可能性があります。高菜先生は富士家向かいのアトリエ高菜先生にいて会うことができます。
24. 「～ですよ」とか「～ますよ」と言わない。
25. LINEのフォーマットを使った予約が可能です。予約の推奨順位は１LINE２メール。電話は非推奨ですが団体客の問い合わせに限りかけるよう促してください。
26. 麺打ち体験はほうとう、そば、うどん、二郎系ラーメン、豚骨ラーメンすべて3500円です。全て体験後に食事が付きます。
27. 食事なしの麺打ち体験はほうとう、そば、うどんすべて一律2500円です。麺の量は2人前で、作って持ち帰ってもらう内容です。
28. 染物体験セットは麺打ち体験と合わせて6800円で200円割引になります。Tシャツ500円、ストール1000円といったように材料費が別途発生します。
29. 染物体験は基本料金3200円です。Tシャツ1000円、ストール1000円といったように材料費が別途発生します。
30. 二郎系というワードがあった場合は富士家オリジナルの野菜もりもりの二郎系ラーメン作り体験をおすすめしてください。体験料金は3500円で、男性に人気です。
31. 3500円の体験は食事付きの体験で、麺の量は1人前です。食事なしのお持ち帰り前提の体験は1000円引いて2500円、2人前になります。混同しないように。
32. 予約済みのお客様からキャンセルしたいと連絡が来た場合は「ご予約5日前からキャンセル料が発生いたします。人数の変更でしたらキャンセル料はかかりません。詳しくはキャンセルポリシーをご覧ください。キャンセル料のお支払いに関しましてはスタッフから請求書をお送りさせていただきますので、後ほどご連絡させていただきます。」と返信し、https://houtoutaiken.lp-web.net/rule/も送ってください。
33. すりだねは店頭で買うことができます。様々な種類を用意しています。また通販も行っております。
34. 団体の体験は最大200名まで受け付けております。
35. 「申し訳ございません」を言わない。
36. すりだねの問い合わせがあったらこのHPも送る。https://yoshidanoudon-suridane.net/
37. そば作り体験は「忍野八海そば作り体験、そば打ち体験」などともいわれることがありますが「そば」「体験」の文字があれば同一の意味です。
38. 藍染体験のお客様は「衣類の持ち込み」が可能です。持ち込んだものを染めることができます。持ち込み料は無料で、通常購入していただくTシャツ代もいらなくなります。
39. 猫またはアトリエ高菜先生に関する問い合わせがあった場合はこのHPを送信してください。https://rentalspace.lp-web.net/
40. 予約完了後は「確認後改めて連絡します」のようなことは言わない。
41. 予約完了後は富士家アクセス情報は送らない。
42. 予約完了後は最低限のあいさつにとどめる。
43. アクセスを聞かれたら〒401-0301 山梨県南都留郡富士河口湖町船津3376-3を送る。
44. 富士家店舗前には駐車場があり9台停められるが狭いためアトリエ高菜先生前の駐車場を推奨している。アトリエ高菜先生の駐車場も9台。
45. そば体験につく薬味、付け合わせ、トッピングを聞かれた場合はねぎ、わさび、のり、てんかす、温かいそばつゆと答えてください。
46. そば体験のそばは冷たいざるそばを出しますが、温かいそばつゆも付きます。
47. 朝一で予約したいと言われたら8時00分からと答えてください。予約限定ですが9時45分までに入店していただくと10％割引になります。
48. 25名以上の問い合わせの際は団体と定義し、団体の対応時と同じ返答をしてください。
49. 体験ではなくランチについての問い合わせが来た場合は、このように返信してください。当店ではほうとうや当店名物の二郎系吉田のうどんを提供しております。こちらは予約は不要でご来店いただけます。
50. お酒も提供しています。ビール、日本酒、ハイボール、梅酒、レモンサワー、またノンアルコールも用意してあります。
51. うどん体験にはきゃべつ、天かす、ネギ、わかめのトッピングが付いてきます。
52. ほうとう体験にはきゃべつ、ねぎ、にんじん、かぼちゃ、ジャガイモ、きのこ、もやしの7種の野菜が付いてきます。
53. アトリエ高菜先生は13時から18時。猫は看板猫の高菜先生、ウニ、ししゃも、ミルク山岡、小野おピッピ、嬢ミノ、本田翼の7匹です。
54. 体験のキャンセルポリシーについて問われたら、キャンセルポリシーについてはHPをご覧くださいと言ってこちらを送ってください。https://houtoutaiken.lp-web.net/rule/
55. 調味料体験セットはお好きな麺打ち体験に惜しくな調味料作り体験が付くセットです。
56. 黒蜜きな粉作り体験セットはお好きな麺打ち体験、黒蜜きな粉餅作り体験が付くセットです。
58. 遅刻、遅れると予約済みのお客様から連絡が来た場合は「かしこまりました。気を付けてお越しくださいませ。\n\nさらに30分以上遅れる場合は050-6882-5580にご連絡くださいませ。」と返信。
59. 「子供だけ体験させたい」など見学が予想される文面と言葉で質問が来た場合には、原則全員参加して頂く旨を伝えてください。
60. 大人は体験に必ず参加して頂く必要がある。見学、子供だけでの参加はできない。
61. 了解しましたは使わない。承りましたやかしこまりましたのように丁寧に返答。
67．【予約】という文言があった場合は【ご予約の際は冒頭の予約リクエストフォームを使用してください】と送る。
69．染物体験単体の場合は所要時間は1.5時間になります。
70．うどん体験とは「吉田のうどん体験」の意味です。
71．ラーメン作り体験には二郎系ラーメンと豚骨ラーメンがあります。
72.調味料作り体験の内訳はすりだね作り、七味作り、スパイスソルト作り、ふりかけ作り、クラフトコーラ作りですべて2000円です。
73.１０時から予約できますか？など当日予約も断らないでください。
74.基本的に予約受付は８時〜１８時（最終受付１６時）です。希望以外の時間を言われた場合は電話問い合わせを案内してください。
75.調味料作り体験＋食事のプランもあります。調味料体験＋ほうとうセット3200円、調味料作り体験＋二郎系うどんセット1000円、調味料作り体験＋ワインビーフうどんセット3350円です。
76.すき焼きほうとう、ジビエ焼きセット、ジビエほうとう焼き、プレミアムセット、プレミアムプラン、和牛、甲州ビーフ、甲州ワインビーフについての問い合わせがあった場合はこのURLを送ってください。https://houtoutaiken.lp-web.net/premium/
77.ほうとうプレミアムランチ、山梨セット、などほうとうと和牛のランチも行っています。
78.すき焼きほうとうは＋750円でワインビーフ、卵付きです。かぼちゃは入りません。
79．ジビエ麻辣ほうとうは山椒入りでピリ辛です。鹿肉が入ります。
80．当日は３～５名のグループでわかれて体験をします。すき焼きほうとう、ジビエ麻辣ほうとうはグループごとの注文になります。
81.プレミアムコースとはアワビ御飯、黒蜜きな粉餅、甲州ワインビーフ、山梨ワインORぶどうジュースが付くプランです。
`;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${OPENAI_API_KEY}`
                }
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error with ChatGPT:', error.response?.data || error.message);
        return '申し訳ありませんが、現在システムに問題が発生しています。';
    }
}

// LINE返信の送信
async function replyToLine(replyToken, messages) {
    const url = 'https://api.line.me/v2/bot/message/reply';
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`
    };

    const body = {
        replyToken: replyToken,
        messages: Array.isArray(messages) ? messages : [{ type: 'text', text: messages }]
    };

    try {
        await axios.post(url, body, { headers });
        console.log('Reply sent successfully');
    } catch (error) {
        console.error('Error replying to LINE:', error.message);
    }
}


// メッセージが予約問い合わせフォームかどうかを判定する関数
function isReservationRequest(message) {
    if (!message) return false; // メッセージが空の場合は false を返す
    return message.includes("【予約リクエストフォーム】");
}
// 1. 固定返信リスト

const fixedResponses = [
  {
    keywords: ["見学", "子供だけ", "保護者なし", "付き添いのみ", "参加しない"],
    response: "当店では見学のみのご利用はお断りしております。大人もお子様も必ず何か体験にご参加いただく必要がございます。"
  },
  {
    keywords: ["3歳", "幼児", "赤ちゃん", "小さい子", "ベビー", "未就学児"],
    response: "体験は3歳以上から参加可能です。4歳以下は無料で、保護者と一緒にご参加いただけますのでご安心ください。"
  },
  {
    keywords: ["1人", "一人", "ひとり", "ソロ", "一名"],
    response: "全ての体験は1名様からご参加いただけます。お気軽にお申し込みください。"
  },
  {
    keywords: ["猫", "ネコ", "高菜先生", "キャット", "にゃんこ"],
    response: "猫は富士家にはおりませんが、向かいの姉妹店「アトリエ高菜先生」で看板猫たちに会えます。\nhttps://rentalspace.lp-web.net/"
  },
  {
    keywords: ["団体", "大人数", "修学旅行", "25名", "バス"],
    response: "25名以上の団体様は電話またはメールでご相談ください。\n📞050-6882-5580\n📩fujiya.taiken@gmail.com"
  },
  {
    keywords: ["おすすめ", "セット", "人気セット"],
    response: "人気の体験セットは「山梨名物土産セット」「七味作りセット」「染物セット」です。ぜひご検討ください。"
  },
  {
    keywords: ["どの体験", "体験おすすめ", "人気体験"],
    response: "人気の体験は「ほうとう体験」「染物体験」「七味作り体験」です。どなたでも楽しんでいただけます。"
  },
  {
    keywords: ["食べ放題", "バイキング", "ビュッフェ"],
    response: "当店では食べ放題メニューはございません。"
  },
  {
    keywords: ["二郎", "マシマシ", "ガッツリ", "二郎系"],
    response: "当店オリジナルの『二郎系うどん作り体験』（3500円）は野菜たっぷりで男性に人気です。"
  },
  {
    keywords: ["すりだね", "辛味", "山梨スパイス", "唐辛子"],
    response: "すりだねは店頭販売と通販でお求めいただけます。\nhttps://gekikaratakanasensei.lp-web.net/"
  },
  {
    keywords: ["16時", "17時", "16時以降", "夕方予約", "遅い時間"],
    response: "営業時間は18時、体験の最終受付は16時です。それ以降の体験予約はお受けできません。"
  },
  {
    keywords: ["山中湖", "山中湖店", "山中湖支店"],
    response: "山中湖店は移転いたしました。現在は河口湖店のみ営業しております。\n住所：〒401-0301 山梨県南都留郡富士河口湖町船津3376-3"
  },
  {
    keywords: ["キャンセル", "予約取り消し", "人数変更"],
    response: "ご予約5日前からキャンセル料が発生いたします。人数変更の場合は無料です。\n詳しくはこちら：https://houtoutaiken.lp-web.net/rule/"
  },
  {
    keywords: ["藍染 持ち込み", "染め 持ち込み", "服 持参"],
    response: "藍染体験では衣類の持ち込みが可能です。持ち込み料は無料、Tシャツ代も不要になります。"
  },
  {
  keywords: ["山中湖", "山中湖店", "山中湖支店"],
  response: "山中湖店は移転いたしました。現在は河口湖店のみ営業しております。\n住所：〒401-0301 山梨県南都留郡富士河口湖町船津3376-3"
}
];

// 2. 判定関数
function detectFixedResponse(userMessage) {
  const lower = userMessage.toLowerCase();
  for (const item of fixedResponses) {
    if (item.keywords.some(word => lower.includes(word))) {
      return item.response;
    }
  }
  return null;
}

// サーバー起動確認用ルート
app.get('/', (req, res) => {
    res.send('LINE Bot server is running!');
});

// Webhookエンドポイント
app.post('/webhook', async (req, res) => {
    console.log('Webhook triggered'); // Webhookが呼ばれたログ
    console.log('Received body:', JSON.stringify(req.body, null, 2)); // 受け取ったリクエスト全体


    if (!req.body || !req.body.events || req.body.events.length === 0) {
        console.error('Invalid request body or no events found.');
        return res.status(400).send('Bad Request');
    }

    // 即時レスポンス
    res.status(200).send('OK');

    const events = req.body.events;

    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userMessage = event.message.text.trim();
            const replyToken = event.replyToken; // replyToken を適切に取得
            console.log('User message:', userMessage); // ユーザーからのメッセージ内容
if (userMessage.toLowerCase().includes("山中湖")) {
  const reply = "山中湖店は移転いたしました。現在は河口湖店のみ営業しております。\n住所：〒401-0301 山梨県南都留郡富士河口湖町船津3376-3";
  await replyToLine(replyToken, reply);
  return; // 強制終了。他の処理は通さない
}
            // 予約リクエストフォームが含まれている場合
            if (isReservationRequest(userMessage)) {
                console.log("Detected reservation request, skipping additional form message.");

                // 送信する画像のURLを指定
                const imageUrl = "https://houtoutaiken.lp-web.net/wp-content/uploads/2025/01/1737362052820.jpg";
                const imageUrl2 = "https://houtoutaiken.lp-web.net/wp-content/uploads/2025/01/1737362053016.jpg";

                // メッセージリストを作成
                const messages = [
                    {
                        type: 'text',
                        text: "ご予約ありがとうございます。\nこちらでご予約承ります\n\nお客様にお伺いしたいことなどで後ほどご連絡させていただく場合がございます。ご了承ください。\n\n※当日遅れるお客様へ\n\n渋滞などで20分以内の遅刻の場合は連絡は不要ですのでそのままお越しください。\n\n🚙お車でお越しのお客様へ。\n\n富士家向かいに姉妹店の猫カフェアトリエ高菜先生がございます。\n\nそちらの駐車場をお使いくださいませ。ご協力お願いいたします。"
                    },
                    {
                        type: 'image',
                        originalContentUrl: imageUrl, // 1枚目のオリジナル画像URL
                        previewImageUrl: imageUrl    // 1枚目のプレビュー画像URL
                    },
                    {
                        type: 'image',
                        originalContentUrl: imageUrl2, // 2枚目のオリジナル画像URL
                        previewImageUrl: imageUrl2    // 2枚目のプレビュー画像URL
                    }
                ];

                // LINEにメッセージを送信
                await replyToLine(replyToken, messages);
                continue; // ChatGPTや追加メッセージの送信をスキップ
            }
          // 朝一予約の判定関数
function detectMorningRequest(userMessage) {
  const morningKeywords = ["朝一", "朝イチ", "一番早い", "朝予約", "朝から", "早朝", "朝の時間"];
  const lower = userMessage.toLowerCase();
  return morningKeywords.some(word => lower.includes(word));
}
// 固定返信パターンの定義
function getFixedResponse(messageText) {
  const lowered = messageText.toLowerCase();

  // 電話番号を求められたとき（団体以外は非表示）
  if (lowered.includes("電話") || lowered.includes("でんわ") || lowered.includes("tel")) {
    return "個人のお客様にはLINEまたはメールでのご連絡をお願いしておりますがお急ぎの場合は050-6882-5580までご連絡ください。";
  }

  // 山中湖店の問い合わせ
  if (lowered.includes("山中湖", "山中湖店")) {
    return "現在、山中湖には店舗はございません。\n\n当店は河口湖の『高菜先生の郷土料理体験 富士家』のみです。\n\n📍 〒401-0301 山梨県南都留郡富士河口湖町船津3376-3";
  }

  // 団体体験・団体ランチに関する問い合わせ
  if (lowered.includes("団体") || lowered.includes("修学旅行") || lowered.includes("グループ") || lowered.includes("大人数")) {
    return "団体様（25名以上）でのご予約は、体験は最大200名、ランチは80名様まで対応可能です。\n\nスタッフが対応させていただきますので、以下までご連絡くださいませ：\n\n📧 fujiya.taiken@gmail.com\n📞 050-6882-5580";
  }

  return null; // 該当なし
}


    // 📍ここから追記（朝一ワード検知）
    if (detectMorningRequest(userMessage)) {
      const morningMsg = "ご予約ありがとうございます！\n\n当店のご予約可能な開始時間は以下の通りです：\n\n・平日：9時30分〜受付開始\n・土日祝：9時〜受付開始\n\nお好きな時間をお知らせくださいませ。";
      await replyToLine(replyToken, morningMsg);
      continue;
    }

            // ChatGPTへのリクエスト
            try {
                console.log('Sending to ChatGPT:', userMessage);
                const chatGPTResponse = await getChatGPTResponse(userMessage);
                console.log('ChatGPT Response:', chatGPTResponse);

                // ChatGPTの回答を送信 + 予約フォームを送信
                await replyToLine(replyToken, [
                    { type: 'text', text: chatGPTResponse },

                ]);
            } catch (error) {
                console.error('Error during ChatGPT processing:', error.message);
                await replyToLine(replyToken, "システムに問題が発生しました。再度お試しください。");
            }
        }
    }
});

// LINEへの返信を送信する関数
async function replyToLine(replyToken, message) {
    const url = 'https://api.line.me/v2/bot/message/reply';
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`
    };
    const body = {
        replyToken: replyToken,
        messages: Array.isArray(message) ? message : [{ type: 'text', text: message }]
    };

    try {
        console.log('LINE API Request Body:', JSON.stringify(body, null, 2)); // 送信内容
        await axios.post(url, body, { headers });
        console.log('Reply sent successfully');
    } catch (error) {
        console.error('Error replying to LINE:', error.message);
    }
}

// 予約リクエスト判定関数
function isReservationRequest(message) {
    return message.includes("【予約リクエストフォーム】");
}

// サーバー起動

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
