import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "또는 이 주소를 브라우저에 붙여 넣으세요:",
  manageEmails: "받을 이메일 선택하기",
  manageEmailsLine: "받을 이메일 선택하기: {url}",
  footer: "{site} 계정이 있어서 이 메일을 받았어요.",
  quoted: "“{text}”",

  verifySubject: "Sonosphere 이메일을 인증해 주세요",
  verifyHeading: "{username} 님, 이메일을 인증해 주세요",
  verifyBody:
    "Sonosphere에 가입해 주셔서 감사해요. 비밀번호를 잊어버려도 계정에 다시 들어올 수 있도록 내 이메일 주소가 맞는지 확인해 주세요.",
  verifyButton: "이메일 인증",
  verifyNote:
    "링크는 3일 동안 유효하며, 설정에서 새 링크를 요청할 수 있어요. {days}일 안에 인증하지 않은 계정은 삭제돼요. 가입한 적이 없다면 이 메일을 무시하세요. 계정은 삭제돼요.",

  purgeSubject: { other: "Sonosphere 계정이 {count}일 후 삭제됩니다" },
  purgeHeading: "{username}님, 계정이 곧 삭제됩니다",
  purgeBody: {
    other:
      "아직 이메일을 인증하지 않으셨습니다. {count}일 이내에 인증하지 않으면 계정과 계정의 모든 내용이 영구적으로 삭제됩니다.",
  },
  purgeNote: "가입한 적이 없다면 이 메시지를 무시하세요. 계정은 삭제됩니다.",

  welcomeSubject: "Sonosphere에 오신 걸 환영해요",
  welcomeHeading: "환영해요, {username} 님",
  welcomeIntro: "이메일 인증이 끝났고 계정이 준비되었어요. 먼저 이런 것들을 해 보세요:",
  welcomeImport:
    "스크로블을 가져오세요. Last.fm이나 파일에서 청취 기록을 가져오면 지금까지 들은 모든 곡으로 프로필, 차트, 추천이 채워져요.",
  welcomeImportButton: "스크로블 가져오기",
  welcomeConnect:
    "그다음 플레이어를 연결하면 앞으로 듣는 모든 곡이 프로필에 스크로블돼요. Spotify, 데스크톱 플레이어, 휴대폰 앱 모두 지원해요.",
  welcomeConnectButton: "플레이어 연결",
  welcomeFollow: "친구를 팔로우하고 취향이 가장 비슷한 사람들, 사운드얼라이크를 찾아보세요.",
  welcomeProfile: "내 프로필: {url}",

  resetSubject: "Sonosphere 비밀번호 재설정",
  resetHeading: "비밀번호 재설정",
  resetBody: "누군가(아마 본인이겠죠) Sonosphere의 {username} 계정 비밀번호 재설정을 요청했어요.",
  resetButton: "새 비밀번호 설정",
  resetNote:
    "링크는 1시간 동안 한 번만 사용할 수 있어요. 요청한 적이 없다면 이 메일을 무시하세요. 비밀번호는 그대로 유지돼요.",

  changeSubject: "Sonosphere 새 이메일을 인증해 주세요",
  changeHeading: "새 이메일 인증",
  changeBody: "Sonosphere의 {username} 님이 앞으로 이 주소를 사용하겠다고 요청했어요. 인증하면 변경이 완료돼요.",
  changeButton: "새 이메일 인증",
  changeNote:
    "링크는 3일 동안 유효해요. 링크를 사용하기 전까지 계정은 기존 주소를 유지해요. 본인이 아니라면 이 메일을 무시하세요.",

  approveSubject: "Sonosphere 이메일 변경을 승인해 주세요",
  approveHeading: "이메일 변경 승인",
  approveBody:
    "{username} 님이 이메일을 {email}(으)로 변경해 달라고 요청했어요. 먼저 여기서 승인해 주세요. 그러면 새 주소로 인증 링크를 보내 드릴게요.",
  approveButton: "이메일 변경 승인",
  approveNote: "이 링크는 1시간 동안 유효해요. 변경을 요청한 적이 없다면 승인하지 말고 비밀번호를 바꿔 주세요.",

  emailChangedSubject: "Sonosphere 이메일이 변경되었어요",
  emailChangedHeading: "이메일이 변경되었어요",
  emailChangedBody:
    "Sonosphere의 {username} 계정 이메일이 {email}(으)로 바뀌었어요. 앞으로 계정 관련 메일은 이 주소로 보내져요.",
  emailChangedWarning:
    "직접 변경하지 않았다면 다른 사람이 비밀번호를 알고 있을 수 있어요. 로그인 페이지에서 비밀번호를 재설정하고 운영팀에 알려 주세요.",

  passwordChangedSubject: "Sonosphere 비밀번호가 변경되었어요",
  passwordChangedHeading: "비밀번호가 변경되었어요",
  passwordChangedBody: "Sonosphere의 {username} 계정 비밀번호가 방금 변경되었고, 다른 모든 기기에서 로그아웃되었어요.",
  passwordSetSubject: "Sonosphere 비밀번호를 설정했어요",
  passwordSetHeading: "비밀번호를 설정했어요",
  passwordSetBody:
    "이제 Sonosphere의 {username} 계정에 비밀번호가 생겼어요. 이 비밀번호로 로그인할 수 있고, 비밀번호를 요구하는 스크로블러 앱에서도 쓸 수 있어요. 다른 사이트로 로그인하는 방법도 그대로 사용할 수 있어요.",
  notYouReset: "본인이 아니라면 지금 바로 로그인 페이지에서 비밀번호를 재설정하세요.",
  resetPasswordButton: "비밀번호 재설정",

  digestSubjectDaily: "오늘의 Sonosphere: 새 소식 {count}개",
  digestSubjectWeekly: "이번 주 Sonosphere: 새 소식 {count}개",
  digestHeading: "{username} 님, 놓친 소식이에요",
  digestMore: "받은편지함에 {count}개가 더 있어요.",
  digestMessages: { other: "{people} 님이 보낸 새 메시지 {count}개" },
  digestPeople: { other: "{count}명" },
  openInbox: "받은편지함 열기",

  followed: "{who} 님이 나를 팔로우하기 시작했어요",
  followedBySomeone: "누군가 나를 팔로우하기 시작했어요",
  seeProfile: "프로필 보기",
  wallReply: "{who} 님이 내 담벼락 글에 답글을 달았어요",
  wallReplyBySomeone: "누군가 내 담벼락 글에 답글을 달았어요",
  wallPost: "{who} 님이 내 담벼락에 글을 남겼어요",
  wallPostBySomeone: "누군가 내 담벼락에 글을 남겼어요",
  seeWall: "담벼락 보기",
  commented: "{who} 님이 “{title}”에 댓글을 달았어요",
  commentedBySomeone: "누군가 “{title}”에 댓글을 달았어요",
  commentedOnJournal: "{who} 님이 “내 저널 글”에 댓글을 달았어요",
  commentedOnJournalBySomeone: "누군가 “내 저널 글”에 댓글을 달았어요",
  seeComment: "댓글 보기",
  messageRequest: "{from} 님이 메시지 요청을 보냈어요",
  seeRequest: "요청 보기",
  messageSent: "{from} 님이 메시지를 보냈어요",
  readIt: "읽기",
} satisfies Translation<typeof en>;
