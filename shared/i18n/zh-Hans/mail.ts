import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "或者把这个链接粘贴到浏览器中：",
  manageEmails: "选择你要接收的邮件",
  manageEmailsLine: "选择你要接收的邮件：{url}",
  footer: "你收到这封邮件，是因为你在 {site} 有账号。",
  quoted: "“{text}”",

  verifySubject: "确认你的 Sonosphere 邮箱",
  verifyHeading: "{username}，你好，请确认你的邮箱",
  verifyBody: "感谢加入 Sonosphere。请确认这是你的邮箱地址，这样万一忘记密码，也能找回你的账号。",
  verifyButton: "确认邮箱",
  verifyNote:
    "链接 3 天内有效；你可以在“设置”中重新申请。{days} 天内未确认的账号会被删除。如果你没有注册过，请忽略这封邮件，该账号将被移除。",

  welcomeSubject: "欢迎来到 Sonosphere",
  welcomeHeading: "欢迎，{username}",
  welcomeIntro: "你的邮箱已确认，账号已准备就绪。先试试这几件事：",
  welcomeImport:
    "把你的播放记录带过来。从 Last.fm 或文件导入你的收听历史，你的个人资料、排行榜和推荐就会根据你听过的所有音乐填充起来。",
  welcomeImportButton: "导入你的播放记录",
  welcomeConnect:
    "然后连接一个播放器，从现在起你播放的每首歌都会记录到你的个人资料。Spotify、桌面播放器和手机应用都可以。",
  welcomeConnectButton: "连接播放器",
  welcomeFollow: "关注好友，找到你的同好：和你品味最接近的人。",
  welcomeProfile: "你的个人资料：{url}",

  resetSubject: "重置你的 Sonosphere 密码",
  resetHeading: "重置你的密码",
  resetBody: "有人（希望是你）申请重置 Sonosphere 上 {username} 的密码。",
  resetButton: "设置新密码",
  resetNote: "链接一小时内有效，且只能使用一次。如果不是你申请的，请忽略这封邮件：你的密码不会改变。",

  changeSubject: "确认你的 Sonosphere 新邮箱",
  changeHeading: "确认你的新邮箱",
  changeBody: "Sonosphere 上的 {username} 申请从现在起使用这个地址。请确认以完成更改。",
  changeButton: "确认新邮箱",
  changeNote: "链接 3 天内有效。在使用之前，账号会继续使用旧地址。如果不是你本人操作，请忽略这封邮件。",

  approveSubject: "批准你的 Sonosphere 邮箱更改",
  approveHeading: "批准邮箱更改",
  approveBody: "{username} 申请将邮箱更改为 {email}。请先在这里批准；之后我们会向新地址发送验证链接。",
  approveButton: "批准邮箱更改",
  approveNote: "此链接一小时内有效。如果你没有申请这项更改，请不要批准，并修改你的密码。",

  emailChangedSubject: "你的 Sonosphere 邮箱已更改",
  emailChangedHeading: "你的邮箱已更改",
  emailChangedBody: "Sonosphere 上 {username} 的邮箱现在是 {email}。今后有关该账号的邮件都会发到那里。",
  emailChangedWarning: "如果这不是你本人更改的，可能有其他人知道了你的密码。请在登录页面重置密码，并告知网站管理团队。",

  passwordChangedSubject: "你的 Sonosphere 密码已更改",
  passwordChangedHeading: "你的密码已更改",
  passwordChangedBody: "Sonosphere 上 {username} 的密码刚刚被更改，其他所有设备都已退出登录。",
  passwordSetSubject: "你在 Sonosphere 设置了密码",
  passwordSetHeading: "你设置了密码",
  passwordSetBody:
    "Sonosphere 上的 {username} 现在有了密码。你可以用它登录，也可以在需要密码的记录应用中使用。通过其他网站登录的方式依然可用。",
  notYouReset: "如果这不是你本人操作，请立即在登录页面重置密码。",
  resetPasswordButton: "重置密码",

  digestSubjectDaily: "你在 Sonosphere 的一天：{count} 条新动态",
  digestSubjectWeekly: "你在 Sonosphere 的一周：{count} 条新动态",
  digestHeading: "{username}，你好，这是你错过的内容",
  digestMore: "收件箱中还有 {count} 条。",
  digestMessages: { other: "{people} 发来 {count} 条新消息" },
  digestPeople: { other: "{count} 人" },
  openInbox: "打开收件箱",

  followed: "{who} 关注了你",
  followedBySomeone: "有人关注了你",
  seeProfile: "查看对方的个人资料",
  wallReply: "{who} 回复了你的留言",
  wallReplyBySomeone: "有人回复了你的留言",
  wallPost: "{who} 在你的留言板上留言了",
  wallPostBySomeone: "有人在你的留言板上留言了",
  seeWall: "查看留言板",
  commented: "{who} 评论了“{title}”",
  commentedBySomeone: "有人评论了“{title}”",
  commentedOnJournal: "{who} 评论了“你的日志文章”",
  commentedOnJournalBySomeone: "有人评论了“你的日志文章”",
  seeComment: "查看评论",
  messageRequest: "{from} 向你发送了消息请求",
  seeRequest: "查看请求",
  messageSent: "{from} 给你发了一条消息",
  readIt: "去看看",
} satisfies Translation<typeof en>;
