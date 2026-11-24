import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "または、これをブラウザに貼り付けてください:",
  manageEmails: "受け取るメールを選ぶ",
  manageEmailsLine: "受け取るメールを選ぶ: {url}",
  footer: "このメールは {site} のアカウントに関するお知らせです。",
  quoted: "「{text}」",

  verifySubject: "Sonosphere のメールアドレスを確認してください",
  verifyHeading: "{username} さん、メールアドレスを確認してください",
  verifyBody:
    "Sonosphere にご登録いただきありがとうございます。パスワードを忘れたときにもアカウントに戻れるよう、このメールアドレスがあなたのものか確認してください。",
  verifyButton: "メールアドレスを確認",
  verifyNote:
    "リンクの有効期限は3日間です。新しいリンクは設定からリクエストできます。{days}日以内に確認されなかったアカウントは削除されます。登録した覚えがない場合は、このメールを無視してください。アカウントは削除されます。",

  purgeSubject: { other: "Sonosphere のアカウントは {count} 日後に削除されます" },
  purgeHeading: "{username} さん、アカウントがまもなく削除されます",
  purgeBody: {
    other:
      "メールアドレスの確認がまだ完了していません。{count} 日以内に確認しないと、アカウントとそのすべての内容が完全に削除されます。",
  },
  purgeNote: "登録した覚えがない場合は、このメッセージを無視してください。アカウントは削除されます。",

  welcomeSubject: "Sonosphere へようこそ",
  welcomeHeading: "ようこそ、{username} さん",
  welcomeIntro: "メールアドレスが確認され、アカウントの準備ができました。まずはこんなことを試してみましょう:",
  welcomeImport:
    "スクロブルを引き継ぎましょう。Last.fm やファイルから再生履歴をインポートすると、これまで聴いたすべての曲をもとにプロフィール、チャート、おすすめが作られます。",
  welcomeImportButton: "スクロブルをインポート",
  welcomeConnect:
    "次にプレーヤーを連携すると、これから再生する曲がすべてプロフィールにスクロブルされます。Spotify、デスクトッププレーヤー、スマホアプリに対応しています。",
  welcomeConnectButton: "プレーヤーを連携",
  welcomeFollow: "友達をフォローして、音楽の好みがいちばん近い「サウンドアライク」を見つけましょう。",
  welcomeProfile: "あなたのプロフィール: {url}",

  resetSubject: "Sonosphere のパスワードをリセット",
  resetHeading: "パスワードをリセット",
  resetBody:
    "Sonosphere の {username} のパスワードのリセットがリクエストされました（あなたご自身であることを願っています）。",
  resetButton: "新しいパスワードを設定",
  resetNote:
    "リンクの有効期限は1時間で、1回のみ使えます。心当たりがない場合は、このメールを無視してください。パスワードは変更されません。",

  changeSubject: "Sonosphere の新しいメールアドレスを確認してください",
  changeHeading: "新しいメールアドレスを確認",
  changeBody: "Sonosphere の {username} が、今後このアドレスを使うようリクエストしました。確認すると変更が完了します。",
  changeButton: "新しいメールアドレスを確認",
  changeNote:
    "リンクの有効期限は3日間です。リンクが使われるまでは、アカウントは以前のアドレスのままです。心当たりがない場合は、このメールを無視してください。",

  approveSubject: "Sonosphere のメールアドレス変更を承認してください",
  approveHeading: "メールアドレスの変更を承認",
  approveBody:
    "{username} が {email} へのメールアドレス変更をリクエストしました。まずここで承認してください。その後、新しいアドレスに確認リンクを送ります。",
  approveButton: "メールアドレスの変更を承認",
  approveNote:
    "このリンクの有効期限は1時間です。この変更をリクエストしていない場合は、承認せずにパスワードを変更してください。",

  emailChangedSubject: "Sonosphere のメールアドレスが変更されました",
  emailChangedHeading: "メールアドレスが変更されました",
  emailChangedBody:
    "Sonosphere の {username} のメールアドレスは {email} になりました。今後、アカウントに関するメールはこのアドレスに届きます。",
  emailChangedWarning:
    "この変更に心当たりがない場合、誰かがあなたのパスワードを知っている可能性があります。ログインページからリセットし、運営チームにお知らせください。",

  passwordChangedSubject: "Sonosphere のパスワードが変更されました",
  passwordChangedHeading: "パスワードが変更されました",
  passwordChangedBody:
    "Sonosphere の {username} のパスワードが変更され、他のすべてのデバイスからサインアウトしました。",
  passwordSetSubject: "Sonosphere でパスワードを設定しました",
  passwordSetHeading: "パスワードを設定しました",
  passwordSetBody:
    "Sonosphere の {username} にパスワードが設定されました。このパスワードでログインしたり、パスワードを求めるスクロブラーアプリで使ったりできます。他のサイトでのサインインも引き続き使えます。",
  notYouReset: "心当たりがない場合は、すぐにログインページからパスワードをリセットしてください。",
  resetPasswordButton: "パスワードをリセット",

  digestSubjectDaily: "今日の Sonosphere: 新着 {count} 件",
  digestSubjectWeekly: "今週の Sonosphere: 新着 {count} 件",
  digestHeading: "{username} さん、見逃したお知らせです",
  digestMore: "ほかに {count} 件が受信箱にあります。",
  digestMessages: { other: "{people} から新着メッセージ {count} 件" },
  digestPeople: { other: "{count} 人" },
  openInbox: "受信箱を開く",

  followed: "{who} さんにフォローされました",
  followedBySomeone: "誰かにフォローされました",
  seeProfile: "プロフィールを見る",
  wallReply: "{who} さんがあなたのウォール投稿に返信しました",
  wallReplyBySomeone: "誰かがあなたのウォール投稿に返信しました",
  wallPost: "{who} さんがあなたのウォールに書き込みました",
  wallPostBySomeone: "誰かがあなたのウォールに書き込みました",
  seeWall: "ウォールを見る",
  commented: "{who} さんが「{title}」にコメントしました",
  commentedBySomeone: "誰かが「{title}」にコメントしました",
  commentedOnJournal: "{who} さんが「あなたのジャーナル投稿」にコメントしました",
  commentedOnJournalBySomeone: "誰かが「あなたのジャーナル投稿」にコメントしました",
  seeComment: "コメントを見る",
  messageRequest: "{from} さんからメッセージリクエストが届きました",
  seeRequest: "リクエストを見る",
  messageSent: "{from} さんからメッセージが届きました",
  readIt: "読む",
} satisfies Translation<typeof en>;
