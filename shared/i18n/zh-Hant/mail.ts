import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "或者把這個連結貼到瀏覽器中：",
  manageEmails: "選擇你要接收的郵件",
  manageEmailsLine: "選擇你要接收的郵件：{url}",
  footer: "你收到這封郵件，是因為你在 {site} 有帳號。",
  quoted: "「{text}」",

  verifySubject: "確認你的 Sonosphere 電子郵件",
  verifyHeading: "{username}，你好，請確認你的電子郵件",
  verifyBody: "感謝加入 Sonosphere。請確認這是你的電子郵件地址，這樣萬一忘記密碼，也能找回你的帳號。",
  verifyButton: "確認電子郵件",
  verifyNote:
    "連結 3 天內有效；你可以在「設定」中重新申請。{days} 天內未確認的帳號會被刪除。如果你沒有註冊過，請忽略這封郵件，該帳號將被移除。",

  welcomeSubject: "歡迎來到 Sonosphere",
  welcomeHeading: "歡迎，{username}",
  welcomeIntro: "你的電子郵件已確認，帳號已準備就緒。先試試這幾件事：",
  welcomeImport:
    "把你的播放紀錄帶過來。從 Last.fm 或檔案匯入你的收聽歷史，你的個人檔案、排行榜和推薦就會根據你聽過的所有音樂填滿。",
  welcomeImportButton: "匯入你的播放紀錄",
  welcomeConnect:
    "接著連結一個播放器，從現在起你播放的每首歌都會記錄到你的個人檔案。Spotify、桌面播放器和手機 App 都可以。",
  welcomeConnectButton: "連結播放器",
  welcomeFollow: "追蹤好友，找到你的同好：和你品味最接近的人。",
  welcomeProfile: "你的個人檔案：{url}",

  resetSubject: "重設你的 Sonosphere 密碼",
  resetHeading: "重設你的密碼",
  resetBody: "有人（希望是你）申請重設 Sonosphere 上 {username} 的密碼。",
  resetButton: "設定新密碼",
  resetNote: "連結一小時內有效，且只能使用一次。如果不是你申請的，請忽略這封郵件：你的密碼不會改變。",

  changeSubject: "確認你的 Sonosphere 新電子郵件",
  changeHeading: "確認你的新電子郵件",
  changeBody: "Sonosphere 上的 {username} 申請從現在起使用這個地址。請確認以完成變更。",
  changeButton: "確認新電子郵件",
  changeNote: "連結 3 天內有效。在使用之前，帳號會繼續使用舊地址。如果不是你本人操作，請忽略這封郵件。",

  approveSubject: "核准你的 Sonosphere 電子郵件變更",
  approveHeading: "核准電子郵件變更",
  approveBody: "{username} 申請將電子郵件變更為 {email}。請先在這裡核准；之後我們會寄送驗證連結到新地址。",
  approveButton: "核准電子郵件變更",
  approveNote: "此連結一小時內有效。如果你沒有申請這項變更，請不要核准，並修改你的密碼。",

  emailChangedSubject: "你的 Sonosphere 電子郵件已變更",
  emailChangedHeading: "你的電子郵件已變更",
  emailChangedBody: "Sonosphere 上 {username} 的電子郵件現在是 {email}。今後有關此帳號的郵件都會寄到那裡。",
  emailChangedWarning: "如果這不是你本人變更的，可能有其他人知道了你的密碼。請在登入頁面重設密碼，並告知網站管理團隊。",

  passwordChangedSubject: "你的 Sonosphere 密碼已變更",
  passwordChangedHeading: "你的密碼已變更",
  passwordChangedBody: "Sonosphere 上 {username} 的密碼剛剛被變更，其他所有裝置都已登出。",
  passwordSetSubject: "你在 Sonosphere 設定了密碼",
  passwordSetHeading: "你設定了密碼",
  passwordSetBody:
    "Sonosphere 上的 {username} 現在有了密碼。你可以用它登入，也可以在需要密碼的記錄 App 中使用。透過其他網站登入的方式依然可用。",
  notYouReset: "如果這不是你本人操作，請立即在登入頁面重設密碼。",
  resetPasswordButton: "重設密碼",

  digestSubjectDaily: "你在 Sonosphere 的一天：{count} 則新動態",
  digestSubjectWeekly: "你在 Sonosphere 的一週：{count} 則新動態",
  digestHeading: "{username}，你好，這是你錯過的內容",
  digestMore: "收件匣中還有 {count} 則。",
  digestMessages: { other: "{people} 傳來 {count} 則新訊息" },
  digestPeople: { other: "{count} 人" },
  openInbox: "開啟收件匣",

  followed: "{who} 追蹤了你",
  followedBySomeone: "有人追蹤了你",
  seeProfile: "查看對方的個人檔案",
  wallReply: "{who} 回覆了你的留言",
  wallReplyBySomeone: "有人回覆了你的留言",
  wallPost: "{who} 在你的留言板上留言了",
  wallPostBySomeone: "有人在你的留言板上留言了",
  seeWall: "查看留言板",
  commented: "{who} 評論了「{title}」",
  commentedBySomeone: "有人評論了「{title}」",
  commentedOnJournal: "{who} 評論了「你的日誌文章」",
  commentedOnJournalBySomeone: "有人評論了「你的日誌文章」",
  seeComment: "查看評論",
  messageRequest: "{from} 向你傳送了訊息請求",
  seeRequest: "查看請求",
  messageSent: "{from} 傳了一則訊息給你",
  readIt: "去看看",
} satisfies Translation<typeof en>;
